import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { analysisResultSchema, assetSchema, sceneSchema, type AnalysisResult } from '@aniforge/shared';
import { analysisFingerprint, validateAnalysisSource, type AnalysisLedger, type AnalysisRequest } from './analysis.js';
import { imageStoragePath } from './assets/storage.js';
import { ApiError } from './errors.js';

const LEASE_MS = 90_000;
const notFound = () => new ApiError(404, 'NOT_FOUND', 'Project, scene or snapshot not found.');

/** Server-only Firestore ledger. Reservation and user quota share a transaction across API instances. */
export class FirestoreAnalysisLedger implements AnalysisLedger {
  constructor(private db: Firestore, private now: () => number = Date.now) {}
  private refs(request: AnalysisRequest) {
    const project = this.db.collection('projects').doc(request.projectId);
    const usage = this.db.collection('analysisUsage').doc(createHash('sha256').update(request.ownerId).digest('hex'));
    return { project, record: project.collection('analyses').doc(request.input.analysisId), usage };
  }
  async reserve(request: AnalysisRequest, dailyLimit: number): Promise<AnalysisResult | null> {
    const { project, record, usage } = this.refs(request);
    return this.db.runTransaction(async (transaction) => {
      const [projectDoc, analysisDoc] = await transaction.getAll(project, record);
      const parent = projectDoc!.data(); const existing = analysisDoc!.data();
      if (!parent || parent.ownerId !== request.ownerId || (parent.lifecycle && parent.lifecycle !== 'active')) throw notFound();
      const fingerprint = analysisFingerprint(request);
      if (existing) {
        if (existing.fingerprint !== fingerprint || existing.ownerId !== request.ownerId) throw new ApiError(409, 'ANALYSIS_ID_CONFLICT', 'This analysis ID belongs to a different request. Start a new analysis explicitly.');
        if (existing.state === 'succeeded') return analysisResultSchema.parse(existing.result);
        if (existing.state === 'failed') throw new ApiError(Number(existing.error.status), String(existing.error.code), String(existing.error.message));
        throw new ApiError(409, 'ANALYSIS_PENDING', 'This analysis is running or has an uncertain outcome. This request ID will not be sent again; check AI Studio before a new request.');
      }
      const [sceneDoc, assetDoc, usageDoc] = await transaction.getAll(project.collection('scenes').doc(request.sceneId), project.collection('assets').doc(request.input.snapshotAssetId), usage);
      const source = sceneDoc!.data(); const rawAsset = assetDoc!.data();
      if (!source || !rawAsset || rawAsset.state !== 'ready' || rawAsset.storagePath !== imageStoragePath(request.ownerId, request.projectId, request.input.snapshotAssetId)) throw notFound();
      const { state: _state, storagePath: _path, ...publicAsset } = rawAsset;
      validateAnalysisSource(sceneSchema.parse(source), assetSchema.parse(publicAsset), request);
      const now = this.now(); const day = new Date(now).toISOString().slice(0, 10); const current = usageDoc!.data();
      if (current?.ownerId && current.ownerId !== request.ownerId) throw notFound();
      if (Number(current?.activeUntil ?? 0) > now) throw new ApiError(429, 'ANALYSIS_BUSY', 'An analysis is already running or its outcome is uncertain. Wait up to 90 seconds and check AI Studio before another request.');
      const attempts = current?.day === day ? Number(current.attempts) : 0;
      if (attempts >= dailyLimit) throw new ApiError(429, 'ANALYSIS_DAILY_LIMIT', 'Your daily analysis limit has been reached. It resets at midnight UTC.');
      transaction.set(usage, { ownerId: request.ownerId, day, attempts: attempts + 1, activeUntil: now + LEASE_MS, activeRequest: record.path });
      transaction.create(record, { ownerId: request.ownerId, sceneId: request.sceneId, fingerprint, state: 'pending', sourceRevision: request.input.expectedRevision, snapshotAssetId: request.input.snapshotAssetId, createdAt: new Date(now).toISOString() });
      return null;
    });
  }
  async complete(request: AnalysisRequest, result: AnalysisResult, interactionId: string) {
    const { project, record, usage } = this.refs(request);
    await this.db.runTransaction(async (transaction) => {
      const [projectDoc, analysisDoc, usageDoc] = await transaction.getAll(project, record, usage);
      const parent = projectDoc!.data(); const current = analysisDoc!.data();
      if (!parent || parent.ownerId !== request.ownerId || (parent.lifecycle && parent.lifecycle !== 'active') || !current) throw notFound();
      if (current.fingerprint !== analysisFingerprint(request) || current.state !== 'pending') throw new ApiError(409, 'ANALYSIS_ID_CONFLICT', 'The analysis record changed. This request will not be sent again.');
      transaction.update(record, { state: 'succeeded', result: analysisResultSchema.parse(result), interactionId, completedAt: new Date(this.now()).toISOString() });
      if (usageDoc!.data()?.activeRequest === record.path) transaction.update(usage, { activeUntil: 0, activeRequest: null });
    });
  }
  async fail(request: AnalysisRequest, error: ApiError, uncertain: boolean) {
    const { project, record, usage } = this.refs(request);
    await this.db.runTransaction(async (transaction) => {
      const [projectDoc, analysisDoc, usageDoc] = await transaction.getAll(project, record, usage);
      const parent = projectDoc!.data(); const current = analysisDoc!.data();
      if (parent?.ownerId === request.ownerId && (!parent.lifecycle || parent.lifecycle === 'active') && current?.state === 'pending' && current.fingerprint === analysisFingerprint(request)) {
        transaction.update(record, { state: 'failed', error: { status: error.statusCode, code: error.code, message: error.message }, uncertain, completedAt: new Date(this.now()).toISOString() });
      }
      if (!uncertain && usageDoc!.data()?.activeRequest === record.path) transaction.update(usage, { activeUntil: 0, activeRequest: null });
    });
  }
}
