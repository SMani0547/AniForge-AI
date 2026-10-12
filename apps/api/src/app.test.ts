import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyScene, type Asset, type Project } from '@aniforge/shared';
import sharp from 'sharp';
import { buildApp } from './app.js';
import { readConfig } from './config.js';
import { assertOwner, type ProjectRepository } from './repository.js';
import { ApiError } from './errors.js';

const project: Project = { id: 'project_1', ownerId: 'alice', title: 'Original sketch', description: '', aspectRatio: '16:9', sceneOrder: ['scene_1'], createdAt: '2026-10-12T00:00:00.000Z', updatedAt: '2026-10-12T00:00:00.000Z', schemaVersion: 1 };
function fixture() {
  const scene = emptyScene(project.id, 'scene_1', project.createdAt);
  const asset: Asset = { id: 'asset_1', projectId: project.id, ownerId: 'alice', sceneId: scene.id, mimeType: 'image/png', sizeBytes: 100, width: 20, height: 10, copyrightAttested: true, createdAt: project.createdAt };
  const repository: ProjectRepository = {
    list: vi.fn(async () => ({ items: [project], nextCursor: null })), get: vi.fn(async () => project),
    create: vi.fn(async () => project), update: vi.fn(async () => project),
    remove: vi.fn(async (_id, owner) => { assertOwner(project, owner); }), duplicate: vi.fn(async () => ({ ...project, id: 'copy_1' })),
    scenes: vi.fn(async () => [scene]), scene: vi.fn(async () => scene),
    updateScene: vi.fn(async (_id, _sceneId, _owner, { expectedRevision: _revision, ...changes }) => ({ ...scene, ...changes, revision: scene.revision + 1 })),
    uploadAsset: vi.fn(async () => asset), asset: vi.fn(async () => asset), assetContent: vi.fn(async () => Buffer.from('test-double-image')),
  };
  const app = buildApp({ config: readConfig({ NODE_ENV: 'test' }), repository, verifyToken: async (token) => { if (token === 'invalid') throw new Error('private failure'); return token; } });
  return { app, repository, scene };
}
const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });
const headers = { authorization: 'Bearer alice' };

describe('project API security and validation (repository/auth test doubles)', () => {
  it('keeps health available but requires identity for projects', async () => {
    const { app, repository } = fixture(); apps.push(app);
    expect((await app.inject({ url: '/health' })).statusCode).toBe(200);
    expect((await app.inject({ url: '/api/v1/projects' })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/v1/projects', headers: { authorization: 'Bearer invalid' } })).statusCode).toBe(401);
    expect(repository.list).not.toHaveBeenCalled();
  });
  it('takes ownership only from verified identity and scopes listing', async () => {
    const { app, repository } = fixture(); apps.push(app);
    const response = await app.inject({ method: 'POST', url: '/api/v1/projects', headers, payload: { title: 'New sketch' } });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ data: project, error: null, requestId: expect.any(String) });
    expect(repository.create).toHaveBeenCalledWith('alice', 'New sketch', '');
    await app.inject({ url: '/api/v1/projects', headers });
    expect(repository.list).toHaveBeenCalledWith('alice', { limit: 25 });
    expect((await app.inject({ method: 'POST', url: '/api/v1/projects', headers, payload: { title: 'New', ownerId: 'bob' } })).statusCode).toBe(400);
  });
  it.each([
    ['GET', '/projects/project_1'], ['PATCH', '/projects/project_1'], ['DELETE', '/projects/project_1'],
    ['POST', '/projects/project_1/duplicate'], ['GET', '/projects/project_1/scenes'],
    ['GET', '/projects/project_1/scenes/scene_1'], ['PATCH', '/projects/project_1/scenes/scene_1'],
  ] as const)('blocks a second user on %s %s before reading descendants or mutating', async (method, url) => {
    const { app, repository } = fixture(); apps.push(app);
    const response = await app.inject({ method, url: `/api/v1${url}`, headers: { authorization: 'Bearer bob' }, ...(method === 'PATCH' ? { payload: { title: 'stolen' } } : {}) });
    expect(response.statusCode).toBe(404);
    expect(repository.update).not.toHaveBeenCalled();
    if (method !== 'DELETE') expect(repository.remove).not.toHaveBeenCalled();
    expect(repository.duplicate).not.toHaveBeenCalled(); expect(repository.scenes).not.toHaveBeenCalled();
    expect(repository.scene).not.toHaveBeenCalled(); expect(repository.updateScene).not.toHaveBeenCalled();
  });
  it('validates source data and permits owner scene edits', async () => {
    const { app, repository, scene } = fixture(); apps.push(app);
    expect((await app.inject({ method: 'PATCH', url: '/api/v1/projects/project_1/scenes/scene_1', headers, payload: { canvas: { ...scene.canvas, width: 10 } } })).statusCode).toBe(400);
    const response = await app.inject({ method: 'PATCH', url: '/api/v1/projects/project_1/scenes/scene_1', headers, payload: { title: 'New angle', canvas: scene.canvas, expectedRevision: 0 } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.title).toBe('New angle');
    expect(repository.updateScene).toHaveBeenCalledWith('project_1', 'scene_1', 'alice', { title: 'New angle', canvas: scene.canvas, expectedRevision: 0 });
  });
  it('reports unconfigured Firebase honestly', async () => {
    const app = buildApp({ config: readConfig({ NODE_ENV: 'test' }), repository: null, verifyToken: null }); apps.push(app);
    const response = await app.inject({ url: '/api/v1/projects', headers });
    expect(response.statusCode).toBe(503); expect(response.json().error.code).toBe('SETUP_REQUIRED');
    expect((await app.inject({ url: '/health' })).json().data.firebaseConfigured).toBe(false);
  });
  it('does not send repository failure details to the browser', async () => {
    const { app, repository } = fixture(); apps.push(app);
    vi.mocked(repository.list).mockRejectedValue(new Error('secret-google-key'));
    const response = await app.inject({ url: '/api/v1/projects', headers });
    expect(response.statusCode).toBe(500); expect(response.body).not.toContain('secret-google-key');
  });
});

describe('private image API and revision conflicts', () => {
  it('requires explicit copyright affirmation before storing or decoding an import', async () => {
    const { app, repository } = fixture(); apps.push(app);
    const response = await app.inject({ method: 'POST', url: '/api/v1/projects/project_1/assets?sceneId=scene_1', headers: { ...headers, 'content-type': 'image/png' }, payload: Buffer.from('not-image') });
    expect(response.statusCode).toBe(400); expect(repository.uploadAsset).not.toHaveBeenCalled();
  });
  it('decodes and normalizes a valid original before saving private metadata', async () => {
    const { app, repository } = fixture(); apps.push(app);
    const bytes = await sharp({ create: { width: 20, height: 10, channels: 3, background: '#abcdef' } }).jpeg().toBuffer();
    const response = await app.inject({ method: 'POST', url: '/api/v1/projects/project_1/assets?sceneId=scene_1&copyrightAttested=true', headers: { ...headers, 'content-type': 'image/jpeg' }, payload: bytes });
    expect(response.statusCode).toBe(201);
    expect(response.json().data).not.toHaveProperty('storagePath');
    expect(repository.uploadAsset).toHaveBeenCalledWith('project_1', 'scene_1', 'alice', { bytes: expect.any(Buffer), width: 20, height: 10 });
    const normalized = vi.mocked(repository.uploadAsset).mock.calls[0]![3];
    expect((await sharp(normalized.bytes).metadata()).format).toBe('png');
  });
  it.each(['', '/content'])('protects private asset%s reads from another user', async (suffix) => {
    const { app, repository } = fixture(); apps.push(app);
    const response = await app.inject({ url: `/api/v1/projects/project_1/assets/asset_1${suffix}`, headers: { authorization: 'Bearer bob' } });
    expect(response.statusCode).toBe(404); expect(repository.asset).not.toHaveBeenCalled(); expect(repository.assetContent).not.toHaveBeenCalled();
  });
  it('rejects foreign and malformed uploads before storage writes', async () => {
    const { app, repository } = fixture(); apps.push(app);
    const url = '/api/v1/projects/project_1/assets?sceneId=scene_1&copyrightAttested=true';
    const payload = Buffer.from('<svg onload="alert(1)">');
    expect((await app.inject({ method: 'POST', url, headers: { authorization: 'Bearer bob', 'content-type': 'image/png' }, payload })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url, headers: { ...headers, 'content-type': 'image/png' }, payload })).statusCode).toBe(400);
    expect(repository.uploadAsset).not.toHaveBeenCalled();
  });
  it('serves owner image bytes without public caching or sniffing', async () => {
    const { app } = fixture(); apps.push(app);
    const response = await app.inject({ url: '/api/v1/projects/project_1/assets/asset_1/content', headers });
    expect(response.statusCode).toBe(200); expect(response.headers['content-type']).toContain('image/png');
    expect(response.headers['cache-control']).toBe('private, no-store'); expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
  it('returns explicit conflict and rejects a save without a revision', async () => {
    const { app, repository } = fixture(); apps.push(app);
    vi.mocked(repository.updateScene).mockRejectedValue(new ApiError(409, 'SCENE_CONFLICT', 'Reload the saved scene.'));
    const url = '/api/v1/projects/project_1/scenes/scene_1';
    expect((await app.inject({ method: 'PATCH', url, headers, payload: { title: 'revision missing' } })).statusCode).toBe(400);
    const response = await app.inject({ method: 'PATCH', url, headers, payload: { title: 'stale save', expectedRevision: 1 } });
    expect(response.statusCode).toBe(409); expect(response.json().error.code).toBe('SCENE_CONFLICT');
  });
  it('validates project page limits and passes the opaque cursor through', async () => {
    const { app, repository } = fixture(); apps.push(app);
    expect((await app.inject({ url: '/api/v1/projects?limit=101', headers })).statusCode).toBe(400);
    const response = await app.inject({ url: '/api/v1/projects?limit=20&cursor=page-token', headers });
    expect(response.statusCode).toBe(200); expect(repository.list).toHaveBeenCalledWith('alice', { limit: 20, cursor: 'page-token' });
    expect(response.json().data).toMatchObject({ items: [project], nextCursor: null });
  });
});

describe('production configuration', () => {
  it('requires real project configuration and rejects emulators in production', () => {
    expect(() => readConfig({ NODE_ENV: 'production' })).toThrow('GOOGLE_CLOUD_PROJECT');
    expect(() => readConfig({ NODE_ENV: 'production', GOOGLE_CLOUD_PROJECT: 'project', FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099' })).toThrow('emulators');
    expect(() => readConfig({ NODE_ENV: 'production', GOOGLE_CLOUD_PROJECT: 'project', FIREBASE_STORAGE_EMULATOR_HOST: 'localhost:9199' })).toThrow('emulators');
    expect(() => readConfig({ NODE_ENV: 'production', GOOGLE_CLOUD_PROJECT: 'project', STORAGE_EMULATOR_HOST: 'http://localhost:9199' })).toThrow('emulators');
  });
  it('only accepts HTTP(S) origins', () => {
    expect(() => readConfig({ ALLOWED_ORIGINS: 'ftp://example.com' })).toThrow('ALLOWED_ORIGINS');
  });
});
