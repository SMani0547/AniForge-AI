import { createHash } from 'node:crypto';
import { analysisResultSchema, type AnalysisAvailability, type AnalysisResult, type AnalyzeScene, type Asset, type Scene } from '@aniforge/shared';
import { ApiError } from './errors.js';
import { safeProviderError } from './ai/errors.js';
import type { SourceImage } from './ai/input.js';
import type { ProjectRepository } from './repository.js';

export interface AnalysisProvider {
  analyze(input: { sourceImage: SourceImage; notes?: string }): Promise<{ shotPlan: unknown; model: string; interactionId: string }>;
}
export interface AnalysisRequest { projectId: string; sceneId: string; ownerId: string; input: AnalyzeScene }
export interface AnalysisLedger {
  reserve(request: AnalysisRequest, dailyLimit: number): Promise<AnalysisResult | null>;
  complete(request: AnalysisRequest, result: AnalysisResult, interactionId: string): Promise<void>;
  fail(request: AnalysisRequest, error: ApiError, uncertain: boolean): Promise<void>;
}
export interface AnalysisRuntime { model: string; provider: AnalysisProvider }
export function analysisFingerprint({ sceneId, input }: AnalysisRequest) {
  return createHash('sha256').update(JSON.stringify([sceneId, input.expectedRevision, input.snapshotAssetId, input.notes])).digest('hex');
}
export function validateAnalysisSource(scene: Scene | null, asset: Asset, request: AnalysisRequest): void {
  if (!scene || scene.id !== request.sceneId || scene.projectId !== request.projectId) throw new ApiError(404, 'NOT_FOUND', 'Scene not found.');
  if (scene.revision !== request.input.expectedRevision) throw new ApiError(409, 'SCENE_CONFLICT', 'The saved scene changed. Save or reload it before starting a new analysis.');
  if (!scene.canvas.objects.some((object) => !object.hidden && object.opacity > 0 && !(object.type === 'brushStroke' && object.tool === 'eraser'))) throw new ApiError(400, 'EMPTY_SCENE', 'Add a visible drawing or image and save the scene before analysis.');
  if (asset.id !== request.input.snapshotAssetId || asset.ownerId !== request.ownerId || asset.projectId !== request.projectId || asset.sceneId !== request.sceneId) throw new ApiError(404, 'NOT_FOUND', 'Scene snapshot not found.');
  if (asset.mimeType !== 'image/png' || asset.width !== 1920 || asset.height !== 1080) throw new ApiError(400, 'INVALID_SNAPSHOT', 'Analyze a full-size 1920 × 1080 PNG exported from the saved canvas.');
}

const providerFailures: Record<string, [number, string]> = {
  REAL_AI_DISABLED: [503, 'Real AI is disabled. The server operator must enable paid Google AI before analysis.'],
  AI_KEY_MISSING: [503, 'Google AI credentials are missing on the server. See docs/cloud-setup.md.'],
  AI_CONFIG_INVALID: [503, 'Google AI analysis configuration is invalid. Check the server model and analysis timeout settings.'],
  AI_RATE_LIMITED: [429, 'Google AI quota or rate limit reached. Check paid-tier quota in AI Studio before starting a new request.'],
  AI_ACCESS_DENIED: [503, 'Google AI denied access. Check the server key, paid billing, model access and API restrictions.'],
  AI_MODEL_UNAVAILABLE: [503, 'The configured Google AI model is unavailable. Verify model access in AI Studio.'],
  AI_REQUEST_REJECTED: [422, 'Google AI rejected this image or request. Review the image, notes and provider content restrictions.'],
  AI_INCOMPLETE: [502, 'Google AI did not complete the analysis. Review provider safety restrictions and status before another attempt.'],
  AI_BAD_ANALYSIS: [502, 'Google AI returned an invalid shot plan. Your drawing and saved plan are unchanged.'],
  AI_BAD_RESPONSE: [502, 'Google AI returned an invalid response. Your drawing and saved plan are unchanged.'],
  AI_TIMEOUT: [504, 'Google AI timed out and may still charge for this request. This request ID will not be sent again. Check AI Studio before starting another analysis.'],
  AI_UNAVAILABLE: [503, 'Google AI is unavailable and the outcome may be uncertain. This request ID will not be sent again. Check AI Studio before another attempt.'],
  AI_REQUEST_FAILED: [502, 'The Google AI request failed and its outcome may be uncertain. This request ID will not be sent again. Check AI Studio before another attempt.'],
  INVALID_SOURCE_IMAGE: [400, 'The saved snapshot is invalid. Export and upload the canvas again.'],
};
export function analysisError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const safe = safeProviderError(error); const [status, message] = providerFailures[safe.code] ?? providerFailures.AI_REQUEST_FAILED!;
  return new ApiError(status, safe.code in providerFailures ? safe.code : 'AI_REQUEST_FAILED', message);
}

export class SceneAnalysisService {
  constructor(private repository: ProjectRepository, private ledger: AnalysisLedger, private runtime: () => AnalysisRuntime, private dailyLimit: number) {}
  availability(): AnalysisAvailability {
    try { return { available: true, reason: 'Real Google AI is configured. Analysis may incur a charge; model access is verified only by a successful request.', model: this.runtime().model }; }
    catch (error) { return { available: false, reason: analysisError(error).message, model: null }; }
  }
  async analyze(request: AnalysisRequest): Promise<AnalysisResult> {
    let runtime: AnalysisRuntime;
    try { runtime = this.runtime(); } catch (error) { throw analysisError(error); }
    let reserved = false; let dispatched = false;
    try {
      const prepared = await preflight(async (checkDeadline) => {
        const replay = await this.ledger.reserve(request, this.dailyLimit);
        if (replay) return { replay };
        reserved = true; checkDeadline();
        // Recheck private metadata after reservation. Never accept an external image URL.
        const [scene, asset] = await Promise.all([
          this.repository.scene(request.projectId, request.sceneId),
          this.repository.asset(request.projectId, request.input.snapshotAssetId, request.ownerId),
        ]);
        checkDeadline(); validateAnalysisSource(scene, asset, request);
        const bytes = await this.repository.assetContent(request.projectId, asset.id, request.ownerId);
        checkDeadline();
        return { asset, bytes };
      });
      if ('replay' in prepared) return prepared.replay!;
      const { asset, bytes } = prepared;
      dispatched = true;
      const output = await runtime.provider.analyze({ sourceImage: { bytes, mimeType: 'image/png', copyrightAttested: true }, notes: request.input.notes });
      const parsed = analysisResultSchema.safeParse({ analysisId: request.input.analysisId, sourceRevision: request.input.expectedRevision, snapshotAssetId: asset.id, shotPlan: output.shotPlan, model: output.model, analyzedAt: new Date().toISOString() });
      if (!parsed.success || !output.interactionId || output.interactionId.length > 2048) throw new ApiError(502, 'AI_BAD_ANALYSIS', providerFailures.AI_BAD_ANALYSIS![1]);
      await this.ledger.complete(request, parsed.data, output.interactionId);
      return parsed.data;
    } catch (error) {
      const safe = analysisError(error);
      const definitive = ['AI_RATE_LIMITED', 'AI_ACCESS_DENIED', 'AI_MODEL_UNAVAILABLE', 'AI_REQUEST_REJECTED'];
      // Ambiguous failures retain the bounded lease. A pending record remains safe if this write fails.
      if (reserved) {
        try { await this.ledger.fail(request, safe, dispatched && !definitive.includes(safe.code)); } catch { /* Never replace the original safe error or redispatch a paid call. */ }
      }
      throw safe;
    }
  }
}

async function preflight<T>(operation: (checkDeadline: () => void) => Promise<T>): Promise<T> {
  let expired = false; let timer: ReturnType<typeof setTimeout> | undefined;
  const failure = () => new ApiError(503, 'ANALYSIS_PREFLIGHT_TIMEOUT', 'Private scene storage took too long to respond. No Google AI request was sent. Try a new analysis after checking server connectivity.');
  const checkDeadline = () => { if (expired) throw failure(); };
  const deadline = new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { expired = true; reject(failure()); }, 5000); });
  try { return await Promise.race([operation(checkDeadline), deadline]); }
  finally { clearTimeout(timer); }
}
