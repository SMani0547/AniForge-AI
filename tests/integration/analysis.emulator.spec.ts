import { randomUUID, createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import sharp from 'sharp';
import type { AnalyzeScene, ShotPlan } from '@aniforge/shared';
import { FirestoreAnalysisLedger } from '../../apps/api/src/analysis-ledger.js';
import { SceneAnalysisService, type AnalysisRequest } from '../../apps/api/src/analysis.js';
import { FirestoreProjectRepository } from '../../apps/api/src/repository.js';
import { CloudAssetStorage } from '../../apps/api/src/assets/storage.js';
import { AiProviderError } from '../../apps/api/src/ai/errors.js';
import { ApiError } from '../../apps/api/src/errors.js';

if (process.env.ANIFORGE_EMULATOR_RUN !== 'true' || process.env.ANIFORGE_EMULATOR_PROFILE !== 'test' || process.env.GOOGLE_CLOUD_PROJECT !== 'demo-aniforge' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18081' || process.env.FIREBASE_STORAGE_EMULATOR_HOST !== '127.0.0.1:19199') throw new Error('Analysis integration tests require the isolated demo-aniforge emulator environment.');
const admin = initializeApp({ projectId: 'demo-aniforge', storageBucket: 'demo-aniforge.appspot.com' }, 'analysis-ledger-tests');
const db = getFirestore(admin);
const repository = new FirestoreProjectRepository(db, new CloudAssetStorage(getStorage(admin), 'demo-aniforge.appspot.com'));
const plan: ShotPlan = { sceneSummary: 'TEST FIXTURE: original square', subjects: [{ name: 'Square', appearance: 'Blue geometric shape' }], action: 'Gentle motion', camera: { shotType: 'Wide', movement: 'Still' }, environment: 'Plain background', mood: 'Calm', animationPrompt: 'Gently move the original square for six seconds.', preserve: ['Shape'], uncertainties: ['Material unknown'] };
const cleanup: Array<{ projectId: string; ownerId: string }> = [];

async function fixture() {
  const ownerId = `analysis-test-${randomUUID()}`;
  const project = await repository.create(ownerId, 'TEST FIXTURE analysis ledger', '');
  cleanup.push({ projectId: project.id, ownerId });
  const initial = (await repository.scenes(project.id))[0]!;
  const scene = await repository.updateScene(project.id, initial.id, ownerId, { expectedRevision: initial.revision, canvas: { ...initial.canvas, objects: [{ id: randomUUID(), type: 'rect', x: 40, y: 40, width: 100, height: 100, rotation: 0, opacity: 1, locked: false, hidden: false, zIndex: 0, fill: '#0000ff', stroke: '#ffffff', strokeWidth: 1 }] } });
  const bytes = await sharp({ create: { width: 1920, height: 1080, channels: 3, background: '#0000ff' } }).png().toBuffer();
  const asset = await repository.uploadAsset(project.id, scene.id, ownerId, { bytes, width: 1920, height: 1080 });
  const input: AnalyzeScene = { analysisId: randomUUID(), expectedRevision: scene.revision, snapshotAssetId: asset.id, notes: 'TEST FIXTURE only.', copyrightAttested: true, confirmPaid: true };
  const request: AnalysisRequest = { projectId: project.id, sceneId: scene.id, ownerId, input };
  let now = Date.parse('2026-10-12T12:00:00.000Z');
  const ledger = new FirestoreAnalysisLedger(db, () => now);
  let dispatches = 0;
  const service = new SceneAnalysisService(repository, ledger, () => ({ model: 'TEST-FIXTURE-model', provider: { analyze: async () => { dispatches++; return { shotPlan: plan, model: 'TEST-FIXTURE-model', interactionId: 'private-fixture-interaction' }; } } }), 2);
  return { request, ledger, service, scene, asset, dispatches: () => dispatches, advance: (milliseconds: number) => { now += milliseconds; } };
}
test.afterEach(async () => {
  for (const item of cleanup.splice(0)) {
    await repository.remove(item.projectId, item.ownerId);
    await db.collection('analysisUsage').doc(createHash('sha256').update(item.ownerId).digest('hex')).delete();
    await db.collection('projects').doc(item.projectId).delete();
  }
});
test.afterAll(async () => { await deleteApp(admin); });

test('durable analysis replay dispatches once, retains source and rejects changed input', async () => {
  const { request, service, dispatches, scene } = await fixture();
  const result = await service.analyze(request);
  expect(result.shotPlan).toEqual(plan);
  expect(await service.analyze(request)).toEqual(result);
  expect(dispatches()).toBe(1);
  await expect(service.analyze({ ...request, input: { ...request.input, notes: 'different input' } })).rejects.toMatchObject({ code: 'ANALYSIS_ID_CONFLICT' });
  expect(dispatches()).toBe(1);
  expect(await repository.scene(request.projectId, request.sceneId)).toEqual(scene);
  const record = (await db.doc(`projects/${request.projectId}/analyses/${request.input.analysisId}`).get()).data();
  expect(record).toMatchObject({ state: 'succeeded', interactionId: 'private-fixture-interaction' });
  expect(result).not.toHaveProperty('interactionId');
  // Successful replay remains available after a later drawing save; it is tagged with the old revision.
  await repository.updateScene(request.projectId, request.sceneId, request.ownerId, { expectedRevision: scene.revision, title: 'Newer source' });
  expect(await service.analyze(request)).toEqual(result);
  expect(dispatches()).toBe(1);
});

test('real Firestore reservation serializes concurrent requests and counts attempts across instances', async () => {
  const { request, ledger, advance } = await fixture();
  const second = { ...request, input: { ...request.input, analysisId: randomUUID() } };
  const results = await Promise.allSettled([ledger.reserve(request, 2), ledger.reserve(second, 2)]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter((result) => result.status === 'rejected').map((result) => result.reason.code)).toEqual(['ANALYSIS_BUSY']);
  const active = results[0]!.status === 'fulfilled' ? request : second;
  const unused = active === request ? second : request;
  // Expiring a lease never allows the original pending ID to dispatch again.
  advance(90_001);
  await expect(ledger.reserve(active, 2)).rejects.toMatchObject({ code: 'ANALYSIS_PENDING' });
  expect(await ledger.reserve(unused, 2)).toBeNull();
  await ledger.fail(unused, new ApiError(429, 'AI_RATE_LIMITED', 'TEST FIXTURE rejected.'), false);
  const anotherInstance = new FirestoreAnalysisLedger(db, () => Date.parse('2026-10-12T12:05:00.000Z'));
  await expect(anotherInstance.reserve({ ...request, input: { ...request.input, analysisId: randomUUID() } }, 2)).rejects.toMatchObject({ code: 'ANALYSIS_DAILY_LIMIT' });
  advance(24 * 60 * 60 * 1000);
  expect(await ledger.reserve({ ...request, input: { ...request.input, analysisId: randomUUID() } }, 2)).toBeNull();
});

test('ambiguous provider failure is durable and holds the lease without redispatch', async () => {
  const { request, ledger, advance } = await fixture();
  let dispatches = 0;
  const service = new SceneAnalysisService(repository, ledger, () => ({ model: 'TEST-FIXTURE-model', provider: { analyze: async () => { dispatches++; throw new AiProviderError('AI_TIMEOUT', 'TEST FIXTURE timed out'); } } }), 3);
  await expect(service.analyze(request)).rejects.toMatchObject({ code: 'AI_TIMEOUT' });
  await expect(service.analyze(request)).rejects.toMatchObject({ code: 'AI_TIMEOUT' });
  expect(dispatches).toBe(1);
  const next = { ...request, input: { ...request.input, analysisId: randomUUID() } };
  await expect(ledger.reserve(next, 3)).rejects.toMatchObject({ code: 'ANALYSIS_BUSY' });
  advance(90_001);
  expect(await ledger.reserve(next, 3)).toBeNull();
});

test('ledger rejects foreign ownership, wrong scene snapshots and stale revisions before quota writes', async () => {
  const { request, ledger } = await fixture();
  await expect(ledger.reserve({ ...request, ownerId: 'someone-else' }, 20)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await expect(ledger.reserve({ ...request, input: { ...request.input, expectedRevision: 0 } }, 20)).rejects.toMatchObject({ code: 'SCENE_CONFLICT' });
  const assetRef = db.doc(`projects/${request.projectId}/assets/${request.input.snapshotAssetId}`);
  await assetRef.update({ sceneId: 'different-scene' });
  await expect(ledger.reserve(request, 20)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  expect((await db.collection('analysisUsage').doc(createHash('sha256').update(request.ownerId).digest('hex')).get()).exists).toBe(false);
  expect((await db.doc(`projects/${request.projectId}/analyses/${request.input.analysisId}`).get()).exists).toBe(false);
});

test('deleting a project during analysis cannot recreate private descendants or return success', async () => {
  const { request, ledger } = await fixture();
  const service = new SceneAnalysisService(repository, ledger, () => ({ model: 'TEST-FIXTURE-model', provider: { analyze: async () => {
    await repository.remove(request.projectId, request.ownerId);
    return { shotPlan: plan, model: 'TEST-FIXTURE-model', interactionId: 'private-fixture-interaction' };
  } } }), 20);
  await expect(service.analyze(request)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  expect(await repository.get(request.projectId)).toBeNull();
  expect((await db.collection('projects').doc(request.projectId).listCollections())).toHaveLength(0);
});
