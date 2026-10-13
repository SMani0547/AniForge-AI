import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyScene, type AnalyzeScene, type Asset, type Project, type ShotPlan } from '@aniforge/shared';
import { SceneAnalysisService, type AnalysisLedger, type AnalysisProvider } from './analysis.js';
import { buildApp } from './app.js';
import { readConfig } from './config.js';
import { AiProviderError } from './ai/errors.js';
import { ApiError } from './errors.js';
import type { ProjectRepository } from './repository.js';

const project: Project = { id: 'project_1', ownerId: 'alice', title: 'TEST FIXTURE drawing', description: '', aspectRatio: '16:9', sceneOrder: ['scene_1'], createdAt: '2026-10-12T00:00:00.000Z', updatedAt: '2026-10-12T00:00:00.000Z', schemaVersion: 1 };
const plan: ShotPlan = { sceneSummary: 'TEST FIXTURE: one original square', subjects: [{ name: 'Square', appearance: 'Blue square' }], action: 'Sway gently', camera: { shotType: 'Wide', movement: 'Still' }, environment: 'Plain background', mood: 'Calm', animationPrompt: 'Animate the original square gently for six seconds.', preserve: ['Shape'], uncertainties: ['Material is unknown'] };
const headers = { authorization: 'Bearer alice' };
const url = '/api/v1/projects/project_1/scenes/scene_1/analyze';
const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => { vi.useRealTimers(); await Promise.all(apps.splice(0).map((app) => app.close())); });

function fixture() {
  const scene = emptyScene(project.id, 'scene_1', project.createdAt);
  scene.revision = 3;
  scene.canvas.objects.push({ id: 'square', type: 'rect', x: 20, y: 20, width: 100, height: 100, rotation: 0, opacity: 1, locked: false, hidden: false, zIndex: 0, fill: '#0000ff', stroke: '#ffffff', strokeWidth: 1 });
  scene.shotPlan = structuredClone(plan);
  const asset: Asset = { id: 'snapshot_1', projectId: project.id, ownerId: 'alice', sceneId: scene.id, mimeType: 'image/png', width: 1920, height: 1080, sizeBytes: 8, copyrightAttested: true, createdAt: project.createdAt };
  const repository: ProjectRepository = {
    thumbnail: async () => null, saveThumbnail: async () => {},
    get: vi.fn(async () => project), list: vi.fn(async () => ({ items: [project], nextCursor: null })),
    create: vi.fn(async () => project), update: vi.fn(async () => project), remove: vi.fn(async () => undefined), duplicate: vi.fn(async () => project),
    scene: vi.fn(async () => scene), scenes: vi.fn(async () => [scene]), updateScene: vi.fn(async () => scene),
    asset: vi.fn(async () => asset), assetContent: vi.fn(async () => Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), uploadAsset: vi.fn(async () => asset),
  };
  const provider: AnalysisProvider = { analyze: vi.fn(async () => ({ shotPlan: structuredClone(plan), model: 'TEST-FIXTURE-model', interactionId: 'server-private-interaction' })) };
  const ledger: AnalysisLedger = { reserve: vi.fn(async () => null), complete: vi.fn(async () => undefined), fail: vi.fn(async () => undefined) };
  const runtime = vi.fn(() => ({ model: 'TEST-FIXTURE-model', provider }));
  const service = new SceneAnalysisService(repository, ledger, runtime, 20);
  const app = buildApp({ config: readConfig({ NODE_ENV: 'test' }), repository, analysis: service, verifyToken: async (token) => token }); apps.push(app);
  const input: AnalyzeScene = { analysisId: randomUUID(), expectedRevision: scene.revision, snapshotAssetId: asset.id, notes: 'Keep the original composition.', confirmPaid: true, copyrightAttested: true };
  return { app, service, repository, provider, ledger, runtime, scene, asset, input };
}

describe('analysis API with explicitly injected test-only provider and repository', () => {
  it('requires authenticated ownership before analysis or status access', async () => {
    const { app, provider, ledger, input } = fixture();
    expect((await app.inject({ method: 'POST', url, payload: input })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/v1/ai/analysis-status' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url, headers: { authorization: 'Bearer bob' }, payload: input })).statusCode).toBe(404);
    expect(provider.analyze).not.toHaveBeenCalled(); expect(ledger.reserve).not.toHaveBeenCalled();
  });
  it('reports configured status without claiming a successful provider connection', async () => {
    const { app, provider } = fixture();
    const response = await app.inject({ url: '/api/v1/ai/analysis-status', headers });
    expect(response.json().data).toMatchObject({ available: true, model: 'TEST-FIXTURE-model' });
    expect(response.json().data.reason).toContain('verified only by a successful request');
    expect(provider.analyze).not.toHaveBeenCalled();
  });
  it('fails closed when AI is disabled before consuming quota or accessing media', async () => {
    const { app, input, runtime, repository, ledger } = fixture();
    runtime.mockImplementation(() => { throw new AiProviderError('REAL_AI_DISABLED', 'private configuration'); });
    expect((await app.inject({ url: '/api/v1/ai/analysis-status', headers })).json().data.available).toBe(false);
    const response = await app.inject({ method: 'POST', url, headers, payload: input });
    expect(response.statusCode).toBe(503); expect(response.json().error.code).toBe('REAL_AI_DISABLED');
    expect(response.body).not.toContain('private configuration'); expect(ledger.reserve).not.toHaveBeenCalled(); expect(repository.assetContent).not.toHaveBeenCalled();
  });
  it.each([{ confirmPaid: false }, { copyrightAttested: false }, { expectedRevision: -1 }, { snapshotUrl: 'https://attacker.invalid/private' }, { notes: 'x'.repeat(8001) }])('rejects malformed, unapproved or external image requests %j', async (changes) => {
    const { app, input, provider, ledger } = fixture();
    expect((await app.inject({ method: 'POST', url, headers, payload: { ...input, ...changes } })).statusCode).toBe(400);
    expect(provider.analyze).not.toHaveBeenCalled(); expect(ledger.reserve).not.toHaveBeenCalled();
  });
  it.each(['stale', 'empty', 'wrong-scene', 'wrong-dimensions'] as const)('does not dispatch for %s saved source', async (problem) => {
    const { app, input, scene, asset, provider } = fixture();
    if (problem === 'stale') input.expectedRevision--;
    if (problem === 'empty') scene.canvas.objects = [];
    if (problem === 'wrong-scene') asset.sceneId = 'another_scene';
    if (problem === 'wrong-dimensions') asset.width = 960;
    const response = await app.inject({ method: 'POST', url, headers, payload: input });
    expect(response.statusCode).toBe(problem === 'stale' ? 409 : problem === 'wrong-scene' ? 404 : 400);
    expect(provider.analyze).not.toHaveBeenCalled();
  });
  it('returns a validated suggestion without overwriting the source or prior plan, hiding interaction IDs', async () => {
    const { app, input, provider, repository, ledger, scene } = fixture();
    const previous = structuredClone(scene);
    const response = await app.inject({ method: 'POST', url, headers, payload: input });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ analysisId: input.analysisId, sourceRevision: 3, snapshotAssetId: 'snapshot_1', shotPlan: plan });
    expect(response.body).not.toContain('server-private-interaction');
    expect(provider.analyze).toHaveBeenCalledWith({ sourceImage: { bytes: expect.any(Buffer), mimeType: 'image/png', copyrightAttested: true }, notes: input.notes });
    expect(repository.updateScene).not.toHaveBeenCalled(); expect(scene).toEqual(previous);
    expect(ledger.complete).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'alice' }), response.json().data, 'server-private-interaction');
  });
  it('returns completed idempotent replay without a second provider or media request', async () => {
    const { app, input, provider, repository, ledger } = fixture();
    const result = { analysisId: input.analysisId, sourceRevision: 3, snapshotAssetId: input.snapshotAssetId, shotPlan: plan, model: 'TEST-FIXTURE-model', analyzedAt: project.createdAt };
    vi.mocked(ledger.reserve).mockResolvedValue(result);
    const response = await app.inject({ method: 'POST', url, headers, payload: input });
    expect(response.json().data).toEqual(result); expect(provider.analyze).not.toHaveBeenCalled(); expect(repository.assetContent).not.toHaveBeenCalled();
  });
  it.each(['ANALYSIS_DAILY_LIMIT', 'ANALYSIS_BUSY', 'ANALYSIS_PENDING'])('does not dispatch after durable %s reservation rejection', async (code) => {
    const { app, input, provider, ledger } = fixture();
    vi.mocked(ledger.reserve).mockRejectedValue(new ApiError(code === 'ANALYSIS_PENDING' ? 409 : 429, code, 'TEST FIXTURE limit reached.'));
    const response = await app.inject({ method: 'POST', url, headers, payload: input });
    expect(response.json().error.code).toBe(code); expect(provider.analyze).not.toHaveBeenCalled(); expect(ledger.fail).not.toHaveBeenCalled();
  });
  it.each([['AI_TIMEOUT', 504, true], ['AI_RATE_LIMITED', 429, false], ['AI_ACCESS_DENIED', 503, false], ['AI_REQUEST_FAILED', 502, true]] as const)('records %s safely without changing source or saved plan', async (code, status, uncertain) => {
    const { app, input, provider, ledger, repository } = fixture();
    vi.mocked(provider.analyze).mockRejectedValue(new AiProviderError(code, 'secret-key-in-sdk-error'));
    const response = await app.inject({ method: 'POST', url, headers, payload: input });
    expect(response.statusCode).toBe(status); expect(response.body).not.toContain('secret-key');
    expect(ledger.fail).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ code }), uncertain);
    expect(repository.updateScene).not.toHaveBeenCalled();
  });
  it('rejects invalid provider suggestions before committing success', async () => {
    const { app, input, provider, ledger } = fixture();
    vi.mocked(provider.analyze).mockResolvedValue({ shotPlan: { privileged: true }, model: 'TEST FIXTURE', interactionId: 'private-id' });
    const response = await app.inject({ method: 'POST', url, headers, payload: input });
    expect(response.statusCode).toBe(502); expect(response.json().error.code).toBe('AI_BAD_ANALYSIS'); expect(ledger.complete).not.toHaveBeenCalled();
  });
  it('reports uncertain result persistence failures without returning an unrecorded success', async () => {
    const { app, input, ledger } = fixture();
    vi.mocked(ledger.complete).mockRejectedValue(new Error('private database failure'));
    vi.mocked(ledger.fail).mockRejectedValue(new Error('also unavailable'));
    const response = await app.inject({ method: 'POST', url, headers, payload: input });
    expect(response.statusCode).toBe(502); expect(response.body).not.toContain('private database'); expect(response.json().data).toBeNull();
  });
  it('bounds private storage preflight and cannot dispatch a late paid call after timeout', async () => {
    vi.useFakeTimers();
    const { service, input, repository, provider, ledger } = fixture();
    let finishRead: (bytes: Buffer) => void = () => undefined;
    vi.mocked(repository.assetContent).mockImplementation(() => new Promise((resolve) => { finishRead = resolve; }));
    const pending = expect(service.analyze({ projectId: project.id, sceneId: 'scene_1', ownerId: 'alice', input })).rejects.toMatchObject({ code: 'ANALYSIS_PREFLIGHT_TIMEOUT' });
    await vi.advanceTimersByTimeAsync(5000); await pending;
    finishRead(Buffer.from('late test-only image')); await vi.advanceTimersByTimeAsync(1);
    expect(provider.analyze).not.toHaveBeenCalled();
    expect(ledger.fail).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ code: 'ANALYSIS_PREFLIGHT_TIMEOUT' }), false);
  });
  it('cannot dispatch after a delayed reservation commits beyond the preflight deadline', async () => {
    vi.useFakeTimers();
    const { service, input, provider, ledger, repository } = fixture();
    let finishReservation: () => void = () => undefined;
    vi.mocked(ledger.reserve).mockImplementation(() => new Promise((resolve) => { finishReservation = () => resolve(null); }));
    const pending = expect(service.analyze({ projectId: project.id, sceneId: 'scene_1', ownerId: 'alice', input })).rejects.toMatchObject({ code: 'ANALYSIS_PREFLIGHT_TIMEOUT' });
    await vi.advanceTimersByTimeAsync(5000); await pending;
    finishReservation(); await vi.advanceTimersByTimeAsync(1);
    expect(provider.analyze).not.toHaveBeenCalled(); expect(repository.assetContent).not.toHaveBeenCalled();
    // The late pending record remains non-dispatchable and its lease expires normally.
    expect(ledger.fail).not.toHaveBeenCalled();
  });
});
