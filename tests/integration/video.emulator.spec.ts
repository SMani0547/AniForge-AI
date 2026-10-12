import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import sharp from 'sharp';
import { FirestoreProjectRepository } from '../../apps/api/src/repository.js';
import { CloudAssetStorage, type AssetStorage } from '../../apps/api/src/assets/storage.js';
import { VideoLedger, WORKER_LEASE_MS, JOB_LIFETIME_MS, type VideoRequest, type JobKey } from '../../apps/api/src/video-ledger.js';
import { VideoService, VideoWorker } from '../../apps/api/src/video.js';
import { AiProviderError } from '../../apps/api/src/ai/errors.js';
import { analysisFixturePlan } from './analysis-fixture.js';
import type { QueuedVideoProvider } from '../../apps/api/src/ai/provider.js';
import { buildApp } from '../../apps/api/src/app.js';
import { readConfig } from '../../apps/api/src/config.js';

if (process.env.ANIFORGE_EMULATOR_RUN !== 'true' || process.env.GOOGLE_CLOUD_PROJECT !== 'demo-aniforge' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8081' || process.env.FIREBASE_STORAGE_EMULATOR_HOST !== '127.0.0.1:9199') throw new Error('Video integration tests require the isolated demo-aniforge emulator environment.');
const admin = initializeApp({ projectId: 'demo-aniforge', storageBucket: 'demo-aniforge.appspot.com' }, 'video-ledger-tests');
const db = getFirestore(admin); const storage = new CloudAssetStorage(getStorage(admin), 'demo-aniforge.appspot.com');
const repository = new FirestoreProjectRepository(db, storage);
const cleanup: Array<{ projectId: string; ownerId: string }> = [];
const bytes = await readFile(new URL('../fixtures/original-square-test-only.mp4', import.meta.url));

async function fixture() {
  const ownerId = `video-test-${randomUUID()}`;
  const project = await repository.create(ownerId, 'TEST FIXTURE video job', ''); cleanup.push({ projectId: project.id, ownerId });
  const initial = (await repository.scenes(project.id))[0]!;
  const scene = await repository.updateScene(project.id, initial.id, ownerId, { expectedRevision: initial.revision, shotPlan: analysisFixturePlan, canvas: { ...initial.canvas, objects: [{ id: randomUUID(), type: 'rect', x: 40, y: 40, width: 100, height: 100, rotation: 0, opacity: 1, locked: false, hidden: false, zIndex: 0, fill: '#0000ff', stroke: '#ffffff', strokeWidth: 1 }] } });
  const png = await sharp({ create: { width: 1920, height: 1080, channels: 3, background: '#0000ff' } }).png().toBuffer();
  const asset = await repository.uploadAsset(project.id, scene.id, ownerId, { bytes: png, width: 1920, height: 1080 });
  const request: VideoRequest = { projectId: project.id, sceneId: scene.id, ownerId, input: { jobId: randomUUID(), expectedRevision: scene.revision, snapshotAssetId: asset.id, copyrightAttested: true, confirmPaid: true } };
  let now = Date.now(); const ledger = new VideoLedger(db, () => now); const queued: JobKey[] = [];
  const service = new VideoService(ledger, () => ({ enqueue: async (key) => { queued.push(key); } }), storage, 2);
  let dispatches = 0; let resumes = 0;
  const output = { bytes, mimeType: 'video/mp4' as const, model: 'TEST-FIXTURE-NOT-GOOGLE', interactionId: 'server-only-fixture-interaction' };
  const provider: QueuedVideoProvider = { generate: async (_input, checkpoint) => { dispatches++; await checkpoint({ interactionId: output.interactionId, fileName: 'files/test-fixture', model: output.model }); return output; }, resume: async () => { resumes++; return output; } };
  const key = { projectId: project.id, jobId: request.input.jobId };
  return { request, key, scene, ledger, service, provider, queued, output, counts: () => ({ dispatches, resumes }), advance: (ms: number) => { now += ms; }, worker: (media: AssetStorage = storage, model = provider) => new VideoWorker(ledger, repository, media, () => model) };
}
test.afterEach(async () => {
  for (const item of cleanup.splice(0)) { await repository.remove(item.projectId, item.ownerId); await db.collection('videoUsage').doc(createHash('sha256').update(item.ownerId).digest('hex')).delete(); await db.collection('projects').doc(item.projectId).delete(); }
});
test.afterAll(async () => { await deleteApp(admin); });

test('queue acknowledgement, duplicate delivery, private MP4 and immutable version survive service restart', async () => {
  const f = await fixture();
  expect((await f.service.generate(f.request)).status).toBe('queued');
  expect(f.counts().dispatches).toBe(0); expect(f.queued).toEqual([f.key]);
  await f.worker().execute(f.key); await f.worker().execute(f.key);
  expect(f.counts()).toEqual({ dispatches: 1, resumes: 0 });
  expect((await f.service.generate(f.request)).status).toBe('succeeded');
  const restarted = new VideoService(new VideoLedger(db), () => ({ enqueue: async () => undefined }), storage, 2);
  expect((await restarted.get(f.key, f.request.ownerId)).status).toBe('succeeded');
  const versions = await restarted.ledger.versions(f.request.projectId, f.request.sceneId, f.request.ownerId);
  expect(versions).toHaveLength(1); expect(versions[0]).not.toHaveProperty('interactionId');
  expect(await restarted.content(f.request.projectId, versions[0]!.id, f.request.ownerId)).toEqual(bytes);
  expect(await repository.scene(f.request.projectId, f.request.sceneId)).toEqual(f.scene);
  const [metadata] = await getStorage(admin).bucket().file(`users/${f.request.ownerId}/projects/${f.request.projectId}/video/${f.key.jobId}.mp4`).getMetadata();
  expect(metadata.contentType).toBe('video/mp4');
  await expect(f.service.generate({ ...f.request, input: { ...f.request.input, expectedRevision: 999 } })).rejects.toMatchObject({ code: 'JOB_ID_CONFLICT' });
});
test('quota transaction serializes different IDs and rejects stale revisions and foreign source', async () => {
  const f = await fixture();
  await expect(f.ledger.reserve({ ...f.request, ownerId: 'other' }, 2)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await expect(f.ledger.reserve({ ...f.request, input: { ...f.request.input, expectedRevision: 0 } }, 2)).rejects.toMatchObject({ code: 'SCENE_CONFLICT' });
  await expect(f.ledger.reserve({ ...f.request, input: { ...f.request.input, snapshotAssetId: 'missing' } }, 2)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  const next = { ...f.request, input: { ...f.request.input, jobId: randomUUID() } };
  const results = await Promise.allSettled([f.service.generate(f.request), f.service.generate(next)]);
  expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter((item) => item.status === 'rejected').map((item) => item.reason.code)).toEqual(['VIDEO_BUSY']);
  f.advance(JOB_LIFETIME_MS + 1);
  const third = { ...f.request, input: { ...f.request.input, jobId: randomUUID() } }; await f.service.generate(third);
  f.advance(JOB_LIFETIME_MS + 1);
  await expect(f.service.generate({ ...third, input: { ...third.input, jobId: randomUUID() } })).rejects.toMatchObject({ code: 'VIDEO_DAILY_LIMIT' });
});
test('expired dispatched worker is terminal and never starts a second paid call', async () => {
  const f = await fixture(); await f.service.generate(f.request);
  const claimed = (await f.ledger.claim(f.key))!; await f.ledger.dispatch(f.key, claimed.leaseToken);
  f.advance(WORKER_LEASE_MS + 1); await f.worker().execute(f.key);
  expect(await f.service.get(f.key, f.request.ownerId)).toMatchObject({ status: 'failed', errorCode: 'GENERATION_OUTCOME_UNKNOWN' });
  expect(f.counts().dispatches).toBe(0);
});
test('download and storage failures retry the checkpoint without regenerating', async () => {
  const f = await fixture(); await f.service.generate(f.request);
  let fail = true;
  const broken: AssetStorage = { put: async (path, content, type) => { if (fail) { fail = false; throw new Error('TEST FIXTURE storage failure'); } await storage.put(path, content, type); }, read: (path) => storage.read(path), copy: (a, b) => storage.copy(a, b), remove: (path) => storage.remove(path), removePrefix: (path) => storage.removePrefix(path) };
  await expect(f.worker(broken).execute(f.key)).rejects.toMatchObject({ code: 'MEDIA_RETRY' });
  await f.worker(broken).execute(f.key);
  expect(f.counts()).toEqual({ dispatches: 1, resumes: 1 });
  expect((await f.service.get(f.key, f.request.ownerId)).status).toBe('succeeded');
});
test('lost publication acknowledgement reuses stored bytes without generating twice', async () => {
  const f = await fixture(); await f.service.generate(f.request);
  const original = f.ledger.complete.bind(f.ledger); let fail = true;
  f.ledger.complete = async (...args) => { if (fail) { fail = false; throw new Error('TEST FIXTURE lost database connection'); } return original(...args); };
  await expect(f.worker().execute(f.key)).rejects.toMatchObject({ code: 'MEDIA_RETRY' });
  await f.worker().execute(f.key); expect(f.counts()).toEqual({ dispatches: 1, resumes: 1 });
  expect((await f.service.get(f.key, f.request.ownerId)).status).toBe('succeeded');
});
test('concurrent worker claims are fenced and repeated file recovery stops after three attempts', async () => {
  const f = await fixture(); await f.service.generate(f.request);
  const claims = await Promise.allSettled([f.ledger.claim(f.key), f.ledger.claim(f.key)]);
  expect(claims.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
  expect(claims.filter((item) => item.status === 'rejected').map((item) => item.reason.code)).toEqual(['JOB_BUSY']);
  const first = claims.find((item) => item.status === 'fulfilled')!; if (first.status !== 'fulfilled' || !first.value) throw new Error('Expected one claim.');
  await f.ledger.dispatch(f.key, first.value.leaseToken);
  await f.ledger.checkpoint(f.key, first.value.leaseToken, { interactionId: 'TEST-FIXTURE', fileName: 'files/fixture', model: 'TEST-FIXTURE' });
  f.advance(WORKER_LEASE_MS + 1);
  const model = { ...f.provider, resume: async () => { throw new Error('TEST FIXTURE unavailable file'); } };
  for (let attempt = 0; attempt < 2; attempt++) await expect(f.worker(storage, model).execute(f.key)).rejects.toMatchObject({ code: 'MEDIA_RETRY' });
  await f.worker(storage, model).execute(f.key);
  expect((await f.service.get(f.key, f.request.ownerId)).errorCode).toBe('DOWNLOAD_RETRIES_EXHAUSTED');
  await expect(f.ledger.checkpoint(f.key, first.value.leaseToken, { interactionId: 'late', fileName: 'files/late', model: 'test' })).rejects.toMatchObject({ code: 'WORKER_LEASE_LOST' });
  expect(f.counts().dispatches).toBe(0);
});
test('outbox recovery publishes an abandoned queue write and expires old queued jobs', async () => {
  const f = await fixture();
  const service = new VideoService(f.ledger, () => ({ enqueue: async () => { throw new Error('TEST FIXTURE queue unavailable'); } }), storage, 2);
  expect((await service.generate(f.request)).status).toBe('queued');
  const recovered: JobKey[] = []; await f.ledger.recover(async (key) => { if (key.projectId === f.key.projectId) recovered.push(key); });
  expect(recovered).toEqual([f.key]);
  f.advance(JOB_LIFETIME_MS + 1); await f.ledger.recover(async () => { throw new Error('Expired jobs must not enqueue.'); });
  expect((await service.get(f.key, f.request.ownerId)).errorCode).toBe('JOB_EXPIRED');
});
test('provider rejection is visible and deleting during generation cannot resurrect descendants', async () => {
  const f = await fixture(); await f.service.generate(f.request);
  await f.worker(storage, { ...f.provider, generate: async () => { throw new AiProviderError('AI_ACCESS_DENIED', 'TEST FIXTURE denied.'); } }).execute(f.key);
  expect(await f.service.get(f.key, f.request.ownerId)).toMatchObject({ status: 'failed', errorCode: 'AI_ACCESS_DENIED' });
  const next = { ...f.request, input: { ...f.request.input, jobId: randomUUID() } }; await f.service.generate(next);
  await f.worker(storage, { ...f.provider, generate: async () => { await repository.remove(f.request.projectId, f.request.ownerId); return f.output; } }).execute({ projectId: f.key.projectId, jobId: next.input.jobId });
  expect(await repository.get(f.key.projectId)).toBeNull();
  expect(await db.collection('projects').doc(f.key.projectId).listCollections()).toHaveLength(0);
});
test('all HTTP video routes reject a foreign owner and worker route is absent from public API', async () => {
  const f = await fixture(); await f.service.generate(f.request); await f.worker().execute(f.key);
  const app = buildApp({ config: readConfig({ NODE_ENV: 'test' }), repository, video: f.service, verifyToken: async (token) => token });
  try {
    for (const path of [`jobs/${f.key.jobId}`, `scenes/${f.request.sceneId}/jobs`, `scenes/${f.request.sceneId}/versions`, `versions/${f.key.jobId}/content`]) {
      const url = `/api/v1/projects/${f.key.projectId}/${path}`;
      expect((await app.inject({ url })).statusCode).toBe(401);
      expect((await app.inject({ url, headers: { authorization: 'Bearer other' } })).statusCode).toBe(404);
      expect((await app.inject({ url, headers: { authorization: `Bearer ${f.request.ownerId}` } })).statusCode).toBe(200);
    }
    expect((await app.inject({ method: 'POST', url: `/api/v1/projects/${f.key.projectId}/scenes/${f.request.sceneId}/generate`, payload: f.request.input, headers: { authorization: 'Bearer other' } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/internal/jobs/execute', payload: f.key })).statusCode).toBe(404);
  } finally { await app.close(); }
});
