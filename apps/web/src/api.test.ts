import { describe, expect, it, vi } from 'vitest';
import { createProjectSchema } from '@aniforge/shared';
import { ApiError, createApiClient, newestFirst } from './api';

const project = { id: 'project-1', ownerId: 'user-1', title: 'Original story', description: '', aspectRatio: '16:9' as const, sceneOrder: ['scene-1'], createdAt: '2026-10-12T00:00:00.000Z', updatedAt: '2026-10-12T00:00:00.000Z', schemaVersion: 1 as const };

describe('authenticated project API client', () => {
  it('does not send a request when the user is signed out', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const api = createApiClient(async () => null, '/api/v1', fetcher);
    await expect(api.listProjects()).rejects.toMatchObject({ status: 401 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('attaches the Firebase ID token and validates cloud project results', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: [project], error: null, requestId: 'req-1' })));
    const api = createApiClient(async () => 'test-id-token', '/api/v1/', fetcher);
    await expect(api.listProjects()).resolves.toEqual([project]);
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
    await expect(api.createProject('My story')).rejects.toEqual(new ApiError('Firestore is not configured.', 503, 'req-2'));
  });

  it('sorts projects without mutating the returned server array', () => {
    const newer = { ...project, id: 'project-2', updatedAt: '2026-10-13T00:00:00.000Z' };
    const original = [project, newer];
    expect(newestFirst(original)).toEqual([newer, project]);
    expect(original).toEqual([project, newer]);
  });
});
