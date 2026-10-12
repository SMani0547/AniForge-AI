import { expect, test } from '@playwright/test';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import type { ApiEnvelope, Scene } from '@aniforge/shared';
import { buildApp } from '../../apps/api/src/app.js';
import { readConfig } from '../../apps/api/src/config.js';
import { FirestoreProjectRepository } from '../../apps/api/src/repository.js';
import { CloudAssetStorage } from '../../apps/api/src/assets/storage.js';
import { VideoLedger, type JobKey } from '../../apps/api/src/video-ledger.js';
import { VideoService, VideoWorker } from '../../apps/api/src/video.js';
import { analysisFixturePlan } from '../integration/analysis-fixture.js';

if (process.env.ANIFORGE_EMULATOR_RUN !== 'true' || process.env.GOOGLE_CLOUD_PROJECT !== 'demo-aniforge' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8081' || process.env.FIREBASE_STORAGE_EMULATOR_HOST !== '127.0.0.1:9199') throw new Error('Video browser test requires local Firebase emulators.');

test('explicit original MP4 fixture queues, stores, plays and survives browser reload', async ({ page }, testInfo) => {
  const admin = initializeApp({ projectId: 'demo-aniforge', storageBucket: 'demo-aniforge.appspot.com' }, `video-browser-${randomUUID()}`);
  const db = getFirestore(admin); const storage = new CloudAssetStorage(getStorage(admin), 'demo-aniforge.appspot.com');
  const repository = new FirestoreProjectRepository(db, storage); const ledger = new VideoLedger(db);
  const queue: JobKey[] = []; const owners = new Set<string>(); const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const bytes = await readFile(new URL('../fixtures/original-square-test-only.mp4', import.meta.url));
  let dispatches = 0;
  const worker = new VideoWorker(ledger, repository, storage, () => ({
    async generate(input, checkpoint) {
      dispatches++; expect(input.sourceImage.bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      await checkpoint({ interactionId: 'test-fixture-only', fileName: 'files/test-fixture', model: 'TEST-FIXTURE-NOT-GOOGLE' });
      return { bytes, mimeType: 'video/mp4', model: 'TEST-FIXTURE-NOT-GOOGLE', interactionId: 'test-fixture-only' };
    }, async resume() { throw new Error('No recovery expected in this browser test.'); },
  }));
  const video = new VideoService(ledger, () => ({ enqueue: async (key) => { queue.push(key); } }), storage, 3);
  const app = buildApp({ config: readConfig({ NODE_ENV: 'test', GOOGLE_CLOUD_PROJECT: 'demo-aniforge' }), repository, video, verifyToken: async (token) => { const uid = (await getAuth(admin).verifyIdToken(token, true)).uid; owners.add(uid); return uid; } });
  const origin = await app.listen({ port: 0, host: '127.0.0.1' });
  await page.route('**/api/v1/**', async (route) => { const url = new URL(route.request().url()); await route.fulfill({ response: await route.fetch({ url: `${origin}${url.pathname}${url.search}` }) }); });
  try {
    await page.goto('/projects'); await page.getByRole('button', { name: 'Continue as a guest' }).click();
    await page.getByRole('button', { name: 'New project', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Project name').fill('TEST FIXTURE video playback');
    await page.getByRole('dialog').getByRole('button', { name: 'Create project', exact: true }).click();
    const loaded = page.waitForResponse((response) => /\/api\/v1\/projects\/[^/]+\/scenes$/.test(response.url()));
    await page.getByRole('button', { name: 'Open TEST FIXTURE video playback', exact: true }).click();
    const scene = ((await (await loaded).json()) as ApiEnvelope<Scene[]>).data![0]!;
    const owner = [...owners][0]!;
    // Seed a reviewed manual plan through the real repository; the generation flow itself is all browser UI.
    await repository.updateScene(scene.projectId, scene.id, owner, { expectedRevision: scene.revision, shotPlan: analysisFixturePlan });
    await page.reload();
    await page.getByRole('button', { name: 'Add rectangle', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Video generation', exact: true });
    await panel.getByLabel('I own or have permission to send this scene to Google for video generation.').check();
    await panel.getByLabel('I approve a paid video attempt. Failure or timeout may still incur Google API charges.').check();
    await panel.getByRole('button', { name: 'Generate animation', exact: true }).click();
    await expect(panel.getByText('Queued', { exact: true })).toBeVisible();
    expect(queue).toHaveLength(1); expect(dispatches).toBe(0);
    await expect(page.getByRole('button', { name: 'Add rectangle', exact: true })).toBeEnabled();
    await page.reload(); await expect(panel.getByText('Queued', { exact: true })).toBeVisible();
    await worker.execute(queue[0]!);
    await panel.getByRole('button', { name: 'Refresh video status' }).click();
    await expect(panel.getByText('Completed', { exact: true })).toBeVisible();
    const clip = page.getByLabel('Generated animation', { exact: true });
    await expect(clip).toBeVisible();
    await expect.poll(() => clip.evaluate((element) => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
    await clip.evaluate(async (element) => { const video = element as HTMLVideoElement; video.muted = true; await video.play(); });
    await expect.poll(() => clip.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(0.1);
    await page.screenshot({ path: testInfo.outputPath('test-fixture-video-player.png'), fullPage: true });
    await page.reload(); await expect(clip).toBeVisible();
    await expect.poll(() => clip.evaluate((element) => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
    expect(dispatches).toBe(1); expect(errors).toEqual([]);
  } finally {
    await page.unrouteAll({ behavior: 'wait' }).catch(() => undefined); await app.close();
    for (const owner of owners) {
      const projects = await db.collection('projects').where('ownerId', '==', owner).get();
      for (const project of projects.docs) { await repository.remove(project.id, owner); await project.ref.delete(); }
      await db.collection('videoUsage').doc(createHash('sha256').update(owner).digest('hex')).delete();
    }
    await deleteApp(admin);
  }
});
