import { describe, expect, it, vi } from 'vitest';
import { createProjectSchema, emptyScene, type AnalyzeScene } from '@aniforge/shared';
import { ApiError, createApiClient, newestFirst } from './api';

const project = { id: 'project-1', ownerId: 'user-1', title: 'Original story', description: '', aspectRatio: '16:9' as const, sceneOrder: ['scene-1'], createdAt: '2026-10-12T00:00:00.000Z', updatedAt: '2026-10-12T00:00:00.000Z', schemaVersion: 1 as const };

describe('authenticated project API client', () => {
  it('validates analysis availability and retains the disabled reason', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: { available: false, reason: 'Local emulator mode: real AI is disabled.', model: null }, error: null, requestId: 'setup' })));
    const api = createApiClient(async () => 'token', '/api/v1', fetcher);
    await expect(api.analysisStatus()).resolves.toMatchObject({ available: false, model: null });
    expect(fetcher).toHaveBeenCalledWith('/api/v1/ai/analysis-status', expect.objectContaining({ headers: { Authorization: 'Bearer token' } }));
  });

  it('passes explicit consent and the stable analysis ID, and rejects malformed model data', async () => {
    const input: AnalyzeScene = { analysisId: '84ce909f-f218-42cf-9858-de975bfcfb69', expectedRevision: 7, snapshotAssetId: 'snapshot', notes: 'Keep the sketch.', copyrightAttested: true, confirmPaid: true };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: { shotPlan: { animationPrompt: 'Incomplete' } }, error: null, requestId: 'analysis' })));
    const api = createApiClient(async () => 'token', '/api/v1', fetcher);
    await expect(api.analyzeScene(project.id, 'scene-1', input)).rejects.toMatchObject({ status: 502 });
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/projects/project-1/scenes/scene-1/analyze');
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual(input);
  });

  it('waits beyond the server analysis deadline and explains uncertain browser timeouts', async () => {
    vi.useFakeTimers();
    try {
      const input: AnalyzeScene = { analysisId: '84ce909f-f218-42cf-9858-de975bfcfb69', expectedRevision: 0, snapshotAssetId: 'snapshot', notes: '', copyrightAttested: true, confirmPaid: true };
      const fetcher = vi.fn<typeof fetch>((_, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')))));
      const api = createApiClient(async () => 'token', '/api/v1', fetcher);
      const pending = api.analyzeScene(project.id, 'scene', input).catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(46_000);
      expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(9_000);
      expect(await pending).toMatchObject({ status: 408, message: expect.stringContaining('Retry the same analysis') });
    } finally { vi.useRealTimers(); }
  });

  it('persists the complete shot plan with the canvas in the same revision checked update', async () => {
    const scene = emptyScene(project.id, 'scene-1', project.createdAt);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: { ...scene, revision: 8 }, error: null, requestId: 'plan-save' })));
    await createApiClient(async () => 'token', '/api/v1', fetcher).saveScene(project.id, scene.id, 7, scene.canvas, null);
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({ expectedRevision: 7, canvas: scene.canvas, shotPlan: null });
  });
  it('does not send a request when the user is signed out', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const api = createApiClient(async () => null, '/api/v1', fetcher);
    await expect(api.listProjects()).rejects.toMatchObject({ status: 401 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('attaches the Firebase ID token and validates cloud project results', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: { items: [project], nextCursor: null }, error: null, requestId: 'req-1' })));
    const api = createApiClient(async () => 'test-id-token', '/api/v1/', fetcher);
    await expect(api.listProjects()).resolves.toEqual({ items: [project], nextCursor: null });
    expect(fetcher).toHaveBeenCalledWith('/api/v1/projects', expect.objectContaining({ headers: { Authorization: 'Bearer test-id-token' }, method: 'GET' }));
  });

  it('rejects malformed success payloads instead of inventing project data', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: [{ title: 'Missing ownership and id' }], error: null, requestId: 'req-bad' })));
    const api = createApiClient(async () => 'test-id-token', '/api/v1', fetcher);
    await expect(api.listProjects()).rejects.toMatchObject({ status: 502, requestId: 'req-bad' });
  });

  it('creates projects using the shared strict request contract', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: project, error: null, requestId: 'req-create' })));
    const api = createApiClient(async () => 'test-id-token', '/api/v1', fetcher);
    await api.createProject('Original story');
    const request = fetcher.mock.calls[0]?.[1];
    expect(request?.method).toBe('POST');
    expect(createProjectSchema.parse(JSON.parse(String(request?.body)))).toEqual({ title: 'Original story', description: '' });
  });

  it('preserves the safe backend error and request reference', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: null, error: { code: 'UNAVAILABLE', message: 'Firestore is not configured.' }, requestId: 'req-2' }), { status: 503 }));
    const api = createApiClient(async () => 'test-id-token', '/api/v1', fetcher);
    await expect(api.createProject('My story')).rejects.toEqual(new ApiError('Firestore is not configured.', 503, 'req-2', 'UNAVAILABLE'));
  });

  it('preserves the pending analysis code so the same request can be checked again', async () => {
    const input: AnalyzeScene = { analysisId: '84ce909f-f218-42cf-9858-de975bfcfb69', expectedRevision: 0, snapshotAssetId: 'snapshot', notes: '', copyrightAttested: true, confirmPaid: true };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: null, error: { code: 'ANALYSIS_PENDING', message: 'This analysis is still running.' }, requestId: 'pending' }), { status: 409 }));
    await expect(createApiClient(async () => 'token', '/api/v1', fetcher).analyzeScene(project.id, 'scene', input)).rejects.toMatchObject({ status: 409, code: 'ANALYSIS_PENDING', requestId: 'pending' });
  });

  it('sorts projects without mutating the returned server array', () => {
    const newer = { ...project, id: 'project-2', updatedAt: '2026-10-13T00:00:00.000Z' };
    const original = [project, newer];
    expect(newestFirst(original)).toEqual([newer, project]);
    expect(original).toEqual([project, newer]);
  });

  it('encodes the opaque pagination cursor without changing it', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: { items: [], nextCursor: null }, error: null, requestId: 'page' })));
    await createApiClient(async () => 'token', '/api/v1', fetcher).listProjects('cursor/+?');
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/projects?cursor=cursor%2F%2B%3F');
  });

  it('sends the saved revision with the canonical canvas and surfaces conflicts', async () => {
    const scene = emptyScene(project.id, 'scene-1', project.createdAt);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: null, error: { code: 'CONFLICT', message: 'Scene changed.' }, requestId: 'save' }), { status: 409 }));
    await expect(createApiClient(async () => 'token', '/api/v1', fetcher).saveScene(project.id, scene.id, 7, scene.canvas)).rejects.toMatchObject({ status: 409 });
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({ expectedRevision: 7, canvas: scene.canvas });
  });

  it('uploads original bytes with authorization, mime type, scene and permission affirmation', async () => {
    const asset = { id: 'asset-1', projectId: project.id, sceneId: 'scene-1', ownerId: project.ownerId, mimeType: 'image/png', sizeBytes: 5, width: 1, height: 1, copyrightAttested: true, createdAt: project.createdAt };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: asset, error: null, requestId: 'upload' })));
    const file = new File(['image'], 'original.webp', { type: 'image/webp' });
    await expect(createApiClient(async () => 'token', '/api/v1', fetcher).uploadAsset(project.id, 'scene-1', file)).resolves.toEqual(asset);
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/projects/project-1/assets?sceneId=scene-1&copyrightAttested=true');
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ body: file, headers: { Authorization: 'Bearer token', 'Content-Type': 'image/webp' } });
  });

  it('loads private image bytes with the current token rather than a public URL', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('image-bytes', { headers: { 'Content-Type': 'image/png' } }));
    const blob = await createApiClient(async () => 'token', '/api/v1', fetcher).getAssetContent(project.id, 'asset-1');
    expect(await blob.text()).toBe('image-bytes');
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ headers: { Authorization: 'Bearer token' } });
  });
});
