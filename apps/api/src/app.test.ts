import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyScene, type Project } from '@aniforge/shared';
import { buildApp } from './app.js';
import { readConfig } from './config.js';
import type { ProjectRepository } from './repository.js';

const project: Project = { id: 'project_1', ownerId: 'alice', title: 'Original sketch', description: '', aspectRatio: '16:9', sceneOrder: ['scene_1'], createdAt: '2026-10-12T00:00:00.000Z', updatedAt: '2026-10-12T00:00:00.000Z', schemaVersion: 1 };
function fixture() {
  const scene = emptyScene(project.id, 'scene_1', project.createdAt);
  const repository: ProjectRepository = {
    list: vi.fn(async () => [project]), get: vi.fn(async () => project),
    create: vi.fn(async () => project), update: vi.fn(async () => project),
    remove: vi.fn(async () => {}), duplicate: vi.fn(async () => ({ ...project, id: 'copy_1' })),
    scenes: vi.fn(async () => [scene]), scene: vi.fn(async () => scene),
    updateScene: vi.fn(async (_id, _sceneId, _owner, changes) => ({ ...scene, ...changes })),
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
    expect(repository.list).toHaveBeenCalledWith('alice');
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
    expect(repository.update).not.toHaveBeenCalled(); expect(repository.remove).not.toHaveBeenCalled();
    expect(repository.duplicate).not.toHaveBeenCalled(); expect(repository.scenes).not.toHaveBeenCalled();
    expect(repository.scene).not.toHaveBeenCalled(); expect(repository.updateScene).not.toHaveBeenCalled();
  });
  it('validates source data and permits owner scene edits', async () => {
    const { app, repository, scene } = fixture(); apps.push(app);
    expect((await app.inject({ method: 'PATCH', url: '/api/v1/projects/project_1/scenes/scene_1', headers, payload: { canvas: { ...scene.canvas, width: 10 } } })).statusCode).toBe(400);
    const response = await app.inject({ method: 'PATCH', url: '/api/v1/projects/project_1/scenes/scene_1', headers, payload: { title: 'New angle', canvas: scene.canvas } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.title).toBe('New angle');
    expect(repository.updateScene).toHaveBeenCalledWith('project_1', 'scene_1', 'alice', { title: 'New angle', canvas: scene.canvas });
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

describe('production configuration', () => {
  it('requires real project configuration and rejects emulators in production', () => {
    expect(() => readConfig({ NODE_ENV: 'production' })).toThrow('GOOGLE_CLOUD_PROJECT');
    expect(() => readConfig({ NODE_ENV: 'production', GOOGLE_CLOUD_PROJECT: 'project', FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099' })).toThrow('emulators');
  });
  it('only accepts HTTP(S) origins', () => {
    expect(() => readConfig({ ALLOWED_ORIGINS: 'ftp://example.com' })).toThrow('ALLOWED_ORIGINS');
  });
});
