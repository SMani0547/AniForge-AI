import { createHash } from 'node:crypto';
import { videoVersionSchema, type AnalysisAvailability } from '@aniforge/shared';
import type { ProjectRepository } from './repository.js';
import type { AssetStorage } from './assets/storage.js';
import { safeProviderError } from './ai/errors.js';
import { validateMp4, type QueuedVideoProvider } from './ai/provider.js';
import { ApiError } from './errors.js';
import { publicJob, VideoLedger, videoStoragePath, type JobKey, type VideoRequest } from './video-ledger.js';

export interface VideoQueue { enqueue(key: JobKey, recovery?: boolean): Promise<void> }
export class VideoService {
  constructor(readonly ledger: VideoLedger, private queue: () => VideoQueue, private storage: AssetStorage, private dailyLimit: number) {}
  availability(): AnalysisAvailability {
    try { this.queue(); return { available: true, model: 'gemini-omni-1.1-flash', reason: 'Paid video generation is enabled. Model access is only verified by a successful Google request. Failed attempts may still incur charges.' }; }
    catch { return { available: false, model: null, reason: 'Video generation requires an enabled private worker, Cloud Tasks queue and paid Google AI setup. See docs/cloud-setup.md.' }; }
  }
  async generate(request: VideoRequest) {
    const queue = this.queue();
    const job = await this.ledger.reserve(request, this.dailyLimit);
    if (job.status === 'queued') {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try { await Promise.race([queue.enqueue({ projectId: request.projectId, jobId: job.id }), new Promise<void>((resolve) => { timer = setTimeout(resolve, 8000); })]); }
      catch { /* Durable outbox remains queued. Recovery job or same-ID retry publishes it. */ }
      finally { clearTimeout(timer); }
    }
    return job;
  }
  async get(key: JobKey, ownerId: string) { return publicJob(await this.ledger.get(key, ownerId)); }
  async content(projectId: string, versionId: string, ownerId: string) {
    const { path, version } = await this.ledger.version(projectId, versionId, ownerId);
    const bytes = await this.storage.read(path);
    if (bytes.length !== version.sizeBytes) throw new ApiError(502, 'VIDEO_UNAVAILABLE', 'Stored video size does not match its version.');
    validateMp4(bytes); return bytes;
  }
}

/** The only paid dispatch entry point. A checkpoint resumes file retrieval, never generation. */
export class VideoWorker {
  constructor(private ledger: VideoLedger, private repository: ProjectRepository, private storage: AssetStorage, private provider: () => QueuedVideoProvider) {}
  async execute(key: JobKey): Promise<void> {
    const record = await this.ledger.claim(key); if (!record) return;
    const token = record.leaseToken;
    try {
      const provider = this.provider();
      let output;
      if (record.checkpoint) output = await provider.resume(record.checkpoint);
      else {
        const bytes = await this.repository.assetContent(key.projectId, record.snapshotAssetId, record.ownerId);
        await this.ledger.dispatch(key, token);
        output = await provider.generate({ sourceImage: { bytes, mimeType: 'image/png', copyrightAttested: true }, prompt: record.prompt }, (checkpoint) => this.ledger.checkpoint(key, token, checkpoint));
      }
      validateMp4(output.bytes);
      if (!output.interactionId || output.interactionId.length > 2048) throw new ApiError(502, 'INVALID_VIDEO_RESULT', 'The provider returned no valid interaction reference.');
      const version = videoVersionSchema.parse({ id: key.jobId, projectId: key.projectId, sceneId: record.sceneId, parentVersionId: null, generationKind: 'initial', model: output.model, prompt: record.prompt, sourceRevision: record.sourceRevision, snapshotAssetId: record.snapshotAssetId, shotPlan: record.shotPlan, mimeType: 'video/mp4', sizeBytes: output.bytes.length, createdAt: new Date().toISOString() });
      const latest = await this.ledger.get(key);
      if (latest.status !== 'running' || latest.leaseToken !== token) return;
      const path = videoStoragePath(record.ownerId, key);
      const sha256 = createHash('sha256').update(output.bytes).digest('hex');
      try { await this.storage.put(path, output.bytes, 'video/mp4'); }
      catch (error) {
        if (!error || typeof error !== 'object' || !('code' in error) || Number(error.code) !== 412) throw error;
        if (createHash('sha256').update(await this.storage.read(path)).digest('hex') !== sha256) throw new ApiError(409, 'VIDEO_CONTENT_CONFLICT', 'An immutable output already exists with different bytes.');
      }
      await this.ledger.complete(key, token, version, output.interactionId, sha256);
    } catch (error) {
      let latest;
      try { latest = await this.ledger.get(key); }
      catch (readError) { if (readError instanceof ApiError && readError.statusCode === 404) return; throw readError; }
      if (latest.status !== 'running' || latest.leaseToken !== token) return;
      if (latest.checkpoint && !(error instanceof ApiError)) {
        await this.ledger.retryDownload(key, token);
        throw new ApiError(503, 'MEDIA_RETRY', 'Retry retrieval of the existing Google file. No new generation will be requested.');
      }
      const safe = error instanceof ApiError ? error : safeProviderError(error);
      await this.ledger.fail(key, token, safe.code, `${safe.message} This job will not generate again. Check AI Studio before starting a new paid job.`.slice(0, 1000));
    }
  }
}
