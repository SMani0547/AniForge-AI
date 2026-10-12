import { createHash, randomUUID } from 'node:crypto';
import { FieldPath, type DocumentData, type Firestore } from 'firebase-admin/firestore';
import { assetSchema, sceneSchema, shotPlanSchema, videoJobSchema, videoPrompt, videoVersionSchema, type EditVideo, type GenerateScene, type ShotPlan, type VideoJob, type VideoVersion } from '@aniforge/shared';
import { validateAnalysisSource } from './analysis.js';
import { imageStoragePath, projectStoragePrefix } from './assets/storage.js';
import type { VideoCheckpoint } from './ai/provider.js';
import { ApiError } from './errors.js';

export const JOB_LIFETIME_MS = 30 * 60_000;
export const WORKER_LEASE_MS = 6 * 60_000;
export interface VideoRequest { projectId: string; sceneId: string; ownerId: string; input: GenerateScene }
export interface VideoEditRequest { projectId: string; sceneId: string; ownerId: string; versionId: string; input: EditVideo }
export interface JobKey { projectId: string; jobId: string }
export interface JobRecord extends VideoJob {
  ownerId: string; fingerprint: string; shotPlan: ShotPlan; prompt: string;
  leaseUntil: number; leaseToken: string; attempts: number; dispatched: boolean;
  checkpoint: VideoCheckpoint | null;
  parentInteractionId: string | null;
}
const missing = () => new ApiError(404, 'NOT_FOUND', 'Project or video job not found.');
function active(parent: DocumentData | undefined, ownerId: string) {
  if (!parent || parent.ownerId !== ownerId || (parent.lifecycle && parent.lifecycle !== 'active')) throw missing();
}
export function publicJob(raw: JobRecord): VideoJob {
  return videoJobSchema.parse(Object.fromEntries(Object.keys(videoJobSchema.shape).map((key) => [key, raw[key as keyof JobRecord]])));
}
export function publicVersion(raw: DocumentData): VideoVersion {
  return videoVersionSchema.parse(Object.fromEntries(Object.keys(videoVersionSchema.shape).map((key) => [key, raw[key]])));
}
export function videoStoragePath(ownerId: string, key: JobKey) { return `${projectStoragePrefix(ownerId, key.projectId)}video/${key.jobId}.mp4`; }
function privateVersion(raw: DocumentData | undefined, projectId: string, versionId: string, ownerId: string) {
  if (!raw || raw.ownerId !== ownerId || raw.id !== versionId || raw.projectId !== projectId || raw.storagePath !== videoStoragePath(ownerId, { projectId, jobId: versionId })) throw missing();
  return { version: publicVersion(raw), path: String(raw.storagePath), interactionId: typeof raw.interactionId === 'string' && raw.interactionId.length > 0 && raw.interactionId.length <= 2048 ? raw.interactionId : null, sha256: typeof raw.sha256 === 'string' ? raw.sha256 : null };
}
export function expiredJob(record: JobRecord, now: number): Partial<JobRecord> | null {
  if (record.status === 'succeeded' || record.status === 'failed') return null;
  if (record.dispatched && !record.checkpoint && record.leaseUntil <= now) return { status: 'failed', errorCode: 'GENERATION_OUTCOME_UNKNOWN', errorMessage: 'The worker stopped after dispatch. Google may still charge. This job will never generate again; inspect AI Studio before starting a new job.' };
  if (Date.parse(record.createdAt) + JOB_LIFETIME_MS <= now) return { status: 'failed', errorCode: 'JOB_EXPIRED', errorMessage: 'The job exceeded its 30 minute lifetime. Check queue, worker and Google AI status before starting another generation.' };
  return null;
}

/** All state transitions check the active project in the same transaction. */
export class VideoLedger {
  constructor(private db: Firestore, private now: () => number = Date.now) {}
  private project(id: string) { return this.db.collection('projects').doc(id); }
  private ref(key: JobKey) { return this.project(key.projectId).collection('jobs').doc(key.jobId); }
  reserve(request: VideoRequest, dailyLimit: number): Promise<VideoJob> { return this.reserveJob(request, dailyLimit); }
  reserveEdit(request: VideoEditRequest, dailyLimit: number): Promise<VideoJob> { return this.reserveJob(request, dailyLimit); }
  private async reserveJob(request: VideoRequest | VideoEditRequest, dailyLimit: number): Promise<VideoJob> {
    const { projectId, ownerId, sceneId, input } = request;
    const project = this.project(projectId); const ref = this.ref({ projectId, jobId: input.jobId });
    const usageRef = this.db.collection('videoUsage').doc(createHash('sha256').update(ownerId).digest('hex'));
    return this.db.runTransaction(async (tx) => {
      const [parent, existing] = await tx.getAll(project, ref); active(parent!.data(), ownerId);
      const fingerprint = createHash('sha256').update(JSON.stringify('versionId' in request ? ['edit', sceneId, request.versionId, request.input.prompt, request.input.mode] : [sceneId, request.input.expectedRevision, request.input.snapshotAssetId])).digest('hex');
      if (existing!.exists) {
        const record = existing!.data() as JobRecord;
        if (record.ownerId !== ownerId || record.fingerprint !== fingerprint) throw new ApiError(409, 'JOB_ID_CONFLICT', 'This job ID already belongs to another request.');
        return publicJob(record);
      }
      const [sceneDoc, sourceDoc, usageDoc] = await tx.getAll(project.collection('scenes').doc(sceneId), 'versionId' in request ? project.collection('videoVersions').doc(request.versionId) : project.collection('assets').doc(request.input.snapshotAssetId), usageRef);
      if (!sceneDoc!.exists) throw missing();
      const scene = sceneSchema.parse(sceneDoc!.data());
      if (scene.id !== sceneId || scene.projectId !== projectId) throw missing();
      let shotPlan: ShotPlan; let prompt: string; let sourceRevision: number; let snapshotAssetId: string; let parentInteractionId: string | null = null;
      if ('versionId' in request) {
        const parentVersion = privateVersion(sourceDoc!.data(), projectId, request.versionId, ownerId);
        if (parentVersion.version.sceneId !== sceneId) throw missing();
        if (request.input.mode === 'interaction' && !parentVersion.interactionId) throw new ApiError(409, 'INTERACTION_UNAVAILABLE', 'This version has no retained Google interaction. Choose the explicit stored-video upload option to request a separate paid edit.');
        shotPlan = parentVersion.version.shotPlan; prompt = request.input.prompt; sourceRevision = parentVersion.version.sourceRevision; snapshotAssetId = parentVersion.version.snapshotAssetId; parentInteractionId = parentVersion.interactionId;
      } else {
        const rawAsset = sourceDoc!.data();
        if (!rawAsset || rawAsset.state !== 'ready' || rawAsset.storagePath !== imageStoragePath(ownerId, projectId, request.input.snapshotAssetId)) throw missing();
        const { storagePath: _path, state: _state, ...asset } = rawAsset;
        validateAnalysisSource(scene, assetSchema.parse(asset), { projectId, sceneId, ownerId, input: { ...request.input, analysisId: input.jobId, notes: '' } });
        const plan = shotPlanSchema.safeParse(scene.shotPlan);
        if (!plan.success) throw new ApiError(400, 'SHOT_PLAN_REQUIRED', 'Save a complete shot plan before generation.');
        shotPlan = plan.data; prompt = videoPrompt(plan.data); sourceRevision = request.input.expectedRevision; snapshotAssetId = request.input.snapshotAssetId;
      }
      if (prompt.length > 8000) throw new ApiError(400, 'PROMPT_TOO_LONG', 'Shorten the shot plan: the combined video prompt must be at most 8000 characters.');
      const now = this.now(); const day = new Date(now).toISOString().slice(0, 10); const usage = usageDoc!.data();
      if (usage?.activePath) {
        const previous = (await tx.get(this.db.doc(String(usage.activePath)))).data() as JobRecord | undefined;
        if (previous && ['queued', 'running'].includes(previous.status) && !expiredJob(previous, now)) throw new ApiError(429, 'VIDEO_BUSY', 'A video job is already active for your account. Wait for its result before generating another.');
      }
      const attempts = usage?.day === day ? Number(usage.attempts) : 0;
      if (attempts >= dailyLimit) throw new ApiError(429, 'VIDEO_DAILY_LIMIT', 'Your daily video attempt limit has been reached. It resets at midnight UTC; failed attempts also count.');
      const record: JobRecord = { id: input.jobId, projectId, sceneId, ownerId, fingerprint, status: 'queued', sourceRevision, snapshotAssetId, shotPlan, prompt, generationKind: 'versionId' in request ? 'edit' : 'initial', parentVersionId: 'versionId' in request ? request.versionId : null, editMode: 'versionId' in request ? request.input.mode : null, parentInteractionId, createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(), resultVersionId: null, errorCode: null, errorMessage: null, leaseUntil: 0, leaseToken: '', attempts: 0, dispatched: false, checkpoint: null };
      tx.create(ref, record); tx.set(usageRef, { ownerId, day, attempts: attempts + 1, activePath: ref.path });
      return publicJob(record);
    });
  }
  async get(key: JobKey, ownerId?: string): Promise<JobRecord> {
    return this.db.runTransaction(async (tx) => {
      const [parent, doc] = await tx.getAll(this.project(key.projectId), this.ref(key));
      if (!doc!.exists) throw missing();
      const record = doc!.data() as JobRecord;
      active(parent!.data(), ownerId ?? record.ownerId);
      if (ownerId && record.ownerId !== ownerId) throw missing();
      const expired = expiredJob(record, this.now());
      if (expired) { Object.assign(record, expired, { updatedAt: new Date(this.now()).toISOString() }); tx.update(this.ref(key), { ...expired, updatedAt: record.updatedAt }); }
      return record;
    });
  }
  async claim(key: JobKey): Promise<JobRecord | null> {
    return this.db.runTransaction(async (tx) => {
      const [parent, doc] = await tx.getAll(this.project(key.projectId), this.ref(key));
      if (!doc!.exists) return null;
      const record = doc!.data() as JobRecord; active(parent!.data(), record.ownerId);
      if (['succeeded', 'failed'].includes(record.status)) return null;
      const expired = expiredJob(record, this.now());
      if (expired) { tx.update(this.ref(key), { ...expired, updatedAt: new Date(this.now()).toISOString() }); return null; }
      if (record.leaseUntil > this.now()) throw new ApiError(503, 'JOB_BUSY', 'This job already has an active worker.');
      if (record.attempts >= 3) { tx.update(this.ref(key), { status: 'failed', errorCode: 'DOWNLOAD_RETRIES_EXHAUSTED', errorMessage: 'Media recovery failed after three worker attempts. Check Storage and Google file availability.', updatedAt: new Date(this.now()).toISOString() }); return null; }
      Object.assign(record, { status: 'running', leaseToken: randomUUID(), leaseUntil: this.now() + WORKER_LEASE_MS, attempts: record.attempts + 1, updatedAt: new Date(this.now()).toISOString() });
      tx.set(this.ref(key), record); return record;
    });
  }
  private async transition(key: JobKey, token: string, changes: Partial<JobRecord>) {
    await this.db.runTransaction(async (tx) => {
      const [parent, doc] = await tx.getAll(this.project(key.projectId), this.ref(key));
      const record = doc!.data() as JobRecord | undefined; if (!record) throw missing(); active(parent!.data(), record.ownerId);
      if (record.status !== 'running' || record.leaseToken !== token || record.leaseUntil <= this.now()) throw new ApiError(409, 'WORKER_LEASE_LOST', 'The worker lease expired.');
      tx.update(this.ref(key), { ...changes, updatedAt: new Date(this.now()).toISOString() });
    });
  }
  dispatch(key: JobKey, token: string) { return this.transition(key, token, { dispatched: true }); }
  checkpoint(key: JobKey, token: string, checkpoint: VideoCheckpoint) { return this.transition(key, token, { checkpoint }); }
  retryDownload(key: JobKey, token: string) { return this.transition(key, token, { leaseUntil: 0 }); }
  fail(key: JobKey, token: string, code: string, message: string) { return this.transition(key, token, { status: 'failed', errorCode: code, errorMessage: message }); }
  async complete(key: JobKey, token: string, version: VideoVersion, interactionId: string, sha256: string) {
    await this.db.runTransaction(async (tx) => {
      const [parent, doc] = await tx.getAll(this.project(key.projectId), this.ref(key));
      const record = doc!.data() as JobRecord | undefined; if (!record) throw missing(); active(parent!.data(), record.ownerId);
      if (record.status !== 'running' || record.leaseToken !== token || record.leaseUntil <= this.now()) throw new ApiError(409, 'WORKER_LEASE_LOST', 'The worker lease expired.');
      tx.create(this.project(key.projectId).collection('videoVersions').doc(version.id), { ...videoVersionSchema.parse(version), interactionId, ownerId: record.ownerId, storagePath: videoStoragePath(record.ownerId, key), sha256 });
      tx.update(this.ref(key), { status: 'succeeded', resultVersionId: version.id, updatedAt: new Date(this.now()).toISOString() });
    });
  }
  async list(key: { projectId: string; sceneId: string }, ownerId: string): Promise<VideoJob[]> {
    active((await this.project(key.projectId).get()).data(), ownerId);
    const docs = await this.project(key.projectId).collection('jobs').where('sceneId', '==', key.sceneId).orderBy('createdAt', 'desc').limit(30).get();
    return Promise.all(docs.docs.map(async (doc) => publicJob(await this.get({ projectId: key.projectId, jobId: doc.id }, ownerId))));
  }
  async versions(projectId: string, sceneId: string, ownerId: string): Promise<VideoVersion[]> {
    active((await this.project(projectId).get()).data(), ownerId);
    const docs = await this.project(projectId).collection('videoVersions').where('sceneId', '==', sceneId).orderBy('createdAt', 'desc').limit(30).get();
    return docs.docs.map((doc) => publicVersion(doc.data()));
  }
  async version(projectId: string, versionId: string, ownerId: string) {
    return this.db.runTransaction(async (tx) => {
      const [parent, doc] = await tx.getAll(this.project(projectId), this.project(projectId).collection('videoVersions').doc(versionId));
      active(parent!.data(), ownerId);
      return privateVersion(doc!.data(), projectId, versionId, ownerId);
    });
  }
  /** Finite Cloud Run recovery job: paginates all nonterminal records, including abandoned outbox writes. */
  async recover(enqueue: (key: JobKey, recovery: boolean) => Promise<void>) {
    let cursor: string | undefined; let failures = 0;
    for (;;) {
      let query = this.db.collectionGroup('jobs').where('status', 'in', ['queued', 'running']).orderBy(FieldPath.documentId()).limit(100);
      if (cursor) query = query.startAfter(this.db.doc(cursor));
      const page = await query.get();
      for (const doc of page.docs) {
        const parts = doc.ref.path.split('/'); if (parts.length !== 4 || parts[0] !== 'projects') continue;
        const key = { projectId: parts[1]!, jobId: doc.id };
        try { const record = await this.get(key); if (['queued', 'running'].includes(record.status) && record.leaseUntil <= this.now()) await enqueue(key, true); }
        catch (error) { if (!(error instanceof ApiError && error.statusCode === 404)) failures++; }
      }
      if (page.size < 100) break; cursor = page.docs.at(-1)!.ref.path;
    }
    if (failures) throw new Error('Video recovery could not process all jobs. Check queue and Firestore permissions.');
  }
}
