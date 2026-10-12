import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import sharp from 'sharp';
import { emptyScene, type EditVideo } from '@aniforge/shared';
import { FirestoreProjectRepository } from '../../apps/api/src/repository.js';
import { CloudAssetStorage } from '../../apps/api/src/assets/storage.js';
import { VideoLedger, type VideoEditRequest, type JobKey } from '../../apps/api/src/video-ledger.js';
import { VideoService, VideoWorker } from '../../apps/api/src/video.js';
import { AiProviderError } from '../../apps/api/src/ai/errors.js';
import type { QueuedVideoProvider, VideoCheckpoint } from '../../apps/api/src/ai/provider.js';
import { buildApp } from '../../apps/api/src/app.js';
import { readConfig } from '../../apps/api/src/config.js';
import { analysisFixturePlan } from './analysis-fixture.js';

if (process.env.ANIFORGE_EMULATOR_RUN !== 'true' || process.env.ANIFORGE_EMULATOR_PROFILE !== 'test' || process.env.GOOGLE_CLOUD_PROJECT !== 'demo-aniforge' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18081' || process.env.FIREBASE_STORAGE_EMULATOR_HOST !== '127.0.0.1:19199') throw new Error('Revision integration tests require isolated Firebase emulators.');
const admin = initializeApp({ projectId: 'demo-aniforge', storageBucket: 'demo-aniforge.appspot.com' }, 'revision-ledger-tests');
const db = getFirestore(admin); const storage = new CloudAssetStorage(getStorage(admin), 'demo-aniforge.appspot.com');
const repository = new FirestoreProjectRepository(db, storage);
const original = await readFile(new URL('../fixtures/original-square-test-only.mp4', import.meta.url));
const revised = await readFile(new URL('../fixtures/revised-square-test-only.mp4', import.meta.url));
const cleanup: Array<{ projectId: string; ownerId: string }> = [];

async function fixture() {
  const ownerId = `revision-test-${randomUUID()}`;
  const project = await repository.create(ownerId, 'TEST FIXTURE video revisions', ''); cleanup.push({ projectId: project.id, ownerId });
  const initial = (await repository.scenes(project.id))[0]!;
  const scene = await repository.updateScene(project.id, initial.id, ownerId, { expectedRevision: initial.revision, shotPlan: analysisFixturePlan, canvas: { ...initial.canvas, objects: [{ id: randomUUID(), type: 'rect', x: 40, y: 40, width: 100, height: 100, rotation: 0, opacity: 1, locked: false, hidden: false, zIndex: 0, fill: '#0000ff', stroke: '#ffffff', strokeWidth: 1 }] } });
  const png = await sharp({ create: { width: 1920, height: 1080, channels: 3, background: '#0000ff' } }).png().toBuffer();
  const asset = await repository.uploadAsset(project.id, scene.id, ownerId, { bytes: png, width: 1920, height: 1080 });
  const ledger = new VideoLedger(db); const queued: JobKey[] = [];
  const service = new VideoService(ledger, () => ({ enqueue: async (key) => { queued.push(key); } }), storage, 20);
  const initialId = randomUUID(); const calls: Array<{ method: string; prompt: string; interactionId?: string; bytes?: Buffer }> = [];
  let failure = false;
  async function result(bytes: Buffer, interactionId: string, checkpoint: (value: VideoCheckpoint) => Promise<void>) {
    await checkpoint({ interactionId, fileName: 'files/test-fixture', model: 'TEST-FIXTURE-NOT-GOOGLE' });
    return { bytes, mimeType: 'video/mp4' as const, model: 'TEST-FIXTURE-NOT-GOOGLE', interactionId };
  }
  const provider: QueuedVideoProvider = {
    generate: async (input, checkpoint) => { calls.push({ method: 'generate', prompt: input.prompt }); return result(original, 'private-original-interaction', checkpoint); },
    edit: async (input, checkpoint) => { calls.push({ method: 'edit', ...input }); if (failure) throw new AiProviderError('AI_MODEL_UNAVAILABLE', 'TEST FIXTURE unavailable interaction.'); return result(revised, 'private-revised-interaction', checkpoint); },
    editVideo: async (input, checkpoint) => { calls.push({ method: 'upload', ...input }); return result(revised, 'private-upload-interaction', checkpoint); },
    resume: async () => { throw new Error('No resume expected in this fixture.'); },
  };
  const worker = new VideoWorker(ledger, repository, storage, () => provider);
  await service.generate({ projectId: project.id, sceneId: scene.id, ownerId, input: { jobId: initialId, expectedRevision: scene.revision, snapshotAssetId: asset.id, copyrightAttested: true, confirmPaid: true } });
  await worker.execute({ projectId: project.id, jobId: initialId });
  const edit = (changes: Partial<EditVideo> = {}): VideoEditRequest => ({ projectId: project.id, sceneId: scene.id, ownerId, versionId: initialId, input: { jobId: randomUUID(), prompt: 'TEST FIXTURE: make the square purple and move upward.', mode: 'interaction', copyrightAttested: true, confirmPaid: true, ...changes } });
  return { projectId: project.id, ownerId, scene, initialId, ledger, service, worker, calls, queued, edit, fail: () => { failure = true; } };
}
test.afterEach(async () => {
  for (const item of cleanup.splice(0)) { await repository.remove(item.projectId, item.ownerId); await db.collection('videoUsage').doc(createHash('sha256').update(item.ownerId).digest('hex')).delete(); await db.collection('projects').doc(item.projectId).delete(); }
});
test.afterAll(async () => { await deleteApp(admin); });

test('conversational edit links its immutable parent and replays without another paid dispatch', async () => {
  const f = await fixture(); const request = f.edit();
  const oldMetadata = (await db.doc(`projects/${f.projectId}/videoVersions/${f.initialId}`).get()).data();
  // Editing an existing clip uses its source revision, even after the drawing changes.
  const current = await repository.updateScene(f.projectId, f.scene.id, f.ownerId, { expectedRevision: f.scene.revision, canvas: { ...f.scene.canvas, background: '#ff0000' }, selectedVideoVersionId: f.initialId });
  expect(await f.service.edit(request)).toMatchObject({ status: 'queued', generationKind: 'edit', parentVersionId: f.initialId, sourceRevision: f.scene.revision });
  await f.worker.execute({ projectId: f.projectId, jobId: request.input.jobId });
  await f.worker.execute({ projectId: f.projectId, jobId: request.input.jobId });
  expect((await f.service.edit(request)).status).toBe('succeeded');
  expect(f.calls.filter((call) => call.method === 'edit')).toEqual([{ method: 'edit', interactionId: 'private-original-interaction', prompt: request.input.prompt }]);
  const versions = await f.ledger.versions(f.projectId, f.scene.id, f.ownerId);
  expect(versions).toHaveLength(2);
  expect(versions.find((version) => version.id === request.input.jobId)).toMatchObject({ generationKind: 'edit', parentVersionId: f.initialId, prompt: request.input.prompt, editMode: 'interaction' });
  expect(versions.every((version) => !('interactionId' in version) && !('storagePath' in version))).toBe(true);
  expect(await f.service.content(f.projectId, f.initialId, f.ownerId)).toEqual(original);
  expect(await f.service.content(f.projectId, request.input.jobId, f.ownerId)).toEqual(revised);
  expect((await db.doc(`projects/${f.projectId}/videoVersions/${f.initialId}`).get()).data()).toEqual(oldMetadata);
  expect(await repository.scene(f.projectId, f.scene.id)).toEqual(current);
  await expect(f.service.edit({ ...request, input: { ...request.input, prompt: 'Changed prompt' } })).rejects.toMatchObject({ code: 'JOB_ID_CONFLICT' });
  await expect(f.service.edit({ ...request, input: { ...request.input, mode: 'upload' } })).rejects.toMatchObject({ code: 'JOB_ID_CONFLICT' });
});

test('a failed interaction edit preserves selection and prior bytes; upload fallback needs a new explicit job', async () => {
  const f = await fixture();
  const saved = await repository.updateScene(f.projectId, f.scene.id, f.ownerId, { expectedRevision: f.scene.revision, selectedVideoVersionId: f.initialId, timeline: { trimStart: 0.2, trimEnd: 1.2, captions: [{ id: 'caption', text: 'Creator caption', start: 0.3, end: 1 }] } });
  f.fail(); const request = f.edit(); await f.service.edit(request); await f.worker.execute({ projectId: f.projectId, jobId: request.input.jobId });
  expect((await f.service.edit(request)).status).toBe('failed');
  expect(f.calls.filter((call) => call.method === 'edit')).toHaveLength(1);
  expect(f.calls.filter((call) => call.method === 'upload')).toHaveLength(0);
  expect(await repository.scene(f.projectId, f.scene.id)).toEqual(saved);
  expect(await f.service.content(f.projectId, f.initialId, f.ownerId)).toEqual(original);
  expect(await f.ledger.versions(f.projectId, f.scene.id, f.ownerId)).toHaveLength(1);
  const upload = f.edit({ mode: 'upload' }); await f.service.edit(upload); await f.worker.execute({ projectId: f.projectId, jobId: upload.input.jobId });
  expect(f.calls.find((call) => call.method === 'upload')?.bytes).toEqual(original);
  expect((await f.service.get({ projectId: f.projectId, jobId: upload.input.jobId }, f.ownerId)).status).toBe('succeeded');
  expect(await repository.scene(f.projectId, f.scene.id)).toEqual(saved);
});

test('parent validation and the shared daily allowance prevent foreign, missing and parallel edit requests', async () => {
  const f = await fixture(); const request = f.edit();
  await expect(f.service.edit({ ...request, ownerId: 'other' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await expect(f.service.edit({ ...request, versionId: 'missing' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  const otherScene = emptyScene(f.projectId, randomUUID(), new Date().toISOString()); await db.doc(`projects/${f.projectId}/scenes/${otherScene.id}`).create(otherScene);
  await expect(f.service.edit({ ...request, sceneId: otherScene.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await expect(f.service.edit(f.edit({ jobId: f.initialId }))).rejects.toMatchObject({ code: 'JOB_ID_CONFLICT' });
  const results = await Promise.allSettled([f.service.edit(request), f.service.edit(f.edit())]);
  expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter((item) => item.status === 'rejected').map((item) => item.reason.code)).toEqual(['VIDEO_BUSY']);
});

test('missing interaction history requires explicit upload and does not consume an attempt at reservation', async () => {
  const f = await fixture();
  await db.doc(`projects/${f.projectId}/videoVersions/${f.initialId}`).update({ interactionId: null });
  const usageRef = db.collection('videoUsage').doc(createHash('sha256').update(f.ownerId).digest('hex'));
  await expect(f.service.edit(f.edit())).rejects.toMatchObject({ code: 'INTERACTION_UNAVAILABLE' });
  expect((await usageRef.get()).data()?.attempts).toBe(1);
  expect(f.queued).toHaveLength(1);
  const upload = f.edit({ mode: 'upload' });
  await f.service.edit(upload); await f.worker.execute({ projectId: f.projectId, jobId: upload.input.jobId });
  expect((await f.service.get({ projectId: f.projectId, jobId: upload.input.jobId }, f.ownerId)).status).toBe('succeeded');
  expect(f.calls.filter((call) => call.method === 'edit')).toHaveLength(0);
  expect(f.calls.find((call) => call.method === 'upload')?.bytes).toEqual(original);
  expect((await usageRef.get()).data()?.attempts).toBe(2);
});

test('deletion during an edit prevents its late result from recreating media or version records', async () => {
  const f = await fixture(); const edit = f.edit(); await f.service.edit(edit);
  let dispatched!: () => void; const started = new Promise<void>((resolve) => { dispatched = resolve; });
  let release!: () => void; const wait = new Promise<void>((resolve) => { release = resolve; });
  const provider: QueuedVideoProvider = {
    generate: async () => { throw new Error('No new generation expected.'); },
    editVideo: async () => { throw new Error('No upload fallback expected.'); },
    resume: async () => { throw new Error('No resume expected.'); },
    edit: async (_input, checkpoint) => { dispatched(); await wait; await checkpoint({ interactionId: 'deleted-edit', fileName: 'files/test-fixture', model: 'TEST-FIXTURE-NOT-GOOGLE' }); return { bytes: revised, mimeType: 'video/mp4', model: 'TEST-FIXTURE-NOT-GOOGLE', interactionId: 'deleted-edit' }; },
  };
  const worker = new VideoWorker(f.ledger, repository, storage, () => provider);
  const execution = worker.execute({ projectId: f.projectId, jobId: edit.input.jobId });
  await started;
  try { await repository.remove(f.projectId, f.ownerId); }
  finally { release(); }
  await execution;
  expect((await db.doc(`projects/${f.projectId}`).get()).data()?.lifecycle).toBe('deleting');
  expect((await db.collection(`projects/${f.projectId}/videoVersions`).get()).empty).toBe(true);
  expect((await db.collection(`projects/${f.projectId}/jobs`).get()).empty).toBe(true);
  await expect(f.service.content(f.projectId, f.initialId, f.ownerId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await expect(f.service.edit(f.edit())).rejects.toMatchObject({ code: 'NOT_FOUND' });
  const [files] = await getStorage(admin).bucket('demo-aniforge.appspot.com').getFiles({ prefix: `users/${f.ownerId}/projects/${f.projectId}/` });
  expect(files).toHaveLength(0);
});

test('version selection and timeline saves share revision control and reject unrelated versions', async () => {
  const f = await fixture(); const edit = f.edit(); await f.service.edit(edit); await f.worker.execute({ projectId: f.projectId, jobId: edit.input.jobId });
  const versionRef = db.doc(`projects/${f.projectId}/videoVersions/${f.initialId}`); const originalMetadata = (await versionRef.get()).data();
  const selected = await repository.updateScene(f.projectId, f.scene.id, f.ownerId, { expectedRevision: f.scene.revision, selectedVideoVersionId: edit.input.jobId });
  await expect(repository.updateScene(f.projectId, f.scene.id, f.ownerId, { expectedRevision: f.scene.revision, selectedVideoVersionId: f.initialId })).rejects.toMatchObject({ code: 'SCENE_CONFLICT' });
  await expect(repository.updateScene(f.projectId, f.scene.id, f.ownerId, { expectedRevision: selected.revision, selectedVideoVersionId: 'missing' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  const other = emptyScene(f.projectId, randomUUID(), new Date().toISOString()); await db.doc(`projects/${f.projectId}/scenes/${other.id}`).create(other);
  await expect(repository.updateScene(f.projectId, other.id, f.ownerId, { expectedRevision: 0, selectedVideoVersionId: f.initialId })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  const restored = await repository.updateScene(f.projectId, f.scene.id, f.ownerId, { expectedRevision: selected.revision, selectedVideoVersionId: f.initialId, timeline: { trimStart: 0.2, trimEnd: 0, captions: [{ id: 'one', text: 'Creator caption', start: 0.3, end: 1.1 }] } });
  expect(restored.selectedVideoVersionId).toBe(f.initialId); expect(restored.canvas).toEqual(f.scene.canvas);
  expect((await versionRef.get()).data()).toEqual(originalMetadata);
  const copy = await repository.duplicate(f.projectId, f.ownerId); cleanup.push({ projectId: copy.id, ownerId: f.ownerId });
  expect((await repository.scenes(copy.id))[0]?.selectedVideoVersionId).toBeNull();
});

test('authorized export returns exact chosen bytes without baking timeline edits, and all new HTTP routes enforce ownership', async () => {
  const f = await fixture(); const edit = f.edit(); await f.service.edit(edit); await f.worker.execute({ projectId: f.projectId, jobId: edit.input.jobId });
  const app = buildApp({ config: readConfig({ NODE_ENV: 'test' }), repository, video: f.service, verifyToken: async (token) => token });
  const base = `/api/v1/projects/${f.projectId}`; const sceneUrl = `${base}/scenes/${f.scene.id}`; const headers = { authorization: `Bearer ${f.ownerId}` };
  try {
    const select = await app.inject({ method: 'PATCH', url: `${sceneUrl}/select-version`, headers, payload: { expectedRevision: f.scene.revision, versionId: edit.input.jobId } }); expect(select.statusCode).toBe(200);
    const revision = select.json().data.revision as number;
    expect((await app.inject({ method: 'PATCH', url: sceneUrl, headers, payload: { expectedRevision: revision, timeline: { trimStart: 0.2, trimEnd: 1.1, captions: [{ id: 'caption', text: 'Not burned in', start: 0.3, end: 1 }] } } })).statusCode).toBe(200);
    const exported = await app.inject({ method: 'POST', url: `${base}/export`, headers, payload: { sceneId: f.scene.id, versionId: edit.input.jobId } });
    expect(exported.statusCode).toBe(200); expect(exported.rawPayload).toEqual(revised); expect(exported.headers['content-type']).toContain('video/mp4'); expect(exported.headers['content-disposition']).toContain('attachment'); expect(exported.headers['cache-control']).toContain('no-store');
    const routes = [{ method: 'POST' as const, url: `${sceneUrl}/versions/${f.initialId}/edit`, payload: f.edit().input }, { method: 'PATCH' as const, url: `${sceneUrl}/select-version`, payload: { expectedRevision: revision, versionId: f.initialId } }, { method: 'POST' as const, url: `${base}/export`, payload: { sceneId: f.scene.id, versionId: edit.input.jobId } }, { method: 'GET' as const, url: `${base}/versions/${f.initialId}` }];
    for (const route of routes) {
      expect((await app.inject(route)).statusCode).toBe(401);
      expect((await app.inject({ ...route, headers: { authorization: 'Bearer stranger' } })).statusCode).toBe(404);
    }
    expect((await app.inject({ method: 'POST', url: `${base}/export`, headers, payload: { sceneId: 'unrelated', versionId: f.initialId } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: `${sceneUrl}/versions/${f.initialId}/edit`, headers, payload: { ...f.edit().input, interactionId: 'forged-private-handle' } })).statusCode).toBe(400);
  } finally { await app.close(); }
});
