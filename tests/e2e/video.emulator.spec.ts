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
import { AiProviderError } from '../../apps/api/src/ai/errors.js';

if (process.env.ANIFORGE_EMULATOR_RUN !== 'true' || process.env.ANIFORGE_EMULATOR_PROFILE !== 'test' || process.env.GOOGLE_CLOUD_PROJECT !== 'demo-aniforge' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:19099' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18081' || process.env.FIREBASE_STORAGE_EMULATOR_HOST !== '127.0.0.1:19199') throw new Error('Video browser test requires local Firebase emulators.');

test('explicit fixtures preserve original and edited clips, selection, timeline and exact MP4 downloads after reload', async ({ page }, testInfo) => {
  const admin = initializeApp({ projectId: 'demo-aniforge', storageBucket: 'demo-aniforge.appspot.com' }, `video-browser-${randomUUID()}`);
  const db = getFirestore(admin); const storage = new CloudAssetStorage(getStorage(admin), 'demo-aniforge.appspot.com');
  const repository = new FirestoreProjectRepository(db, storage); const ledger = new VideoLedger(db);
  const queue: JobKey[] = []; const owners = new Set<string>(); const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const bytes = await readFile(new URL('../fixtures/original-square-test-only.mp4', import.meta.url));
  const revised = await readFile(new URL('../fixtures/revised-square-test-only.mp4', import.meta.url));
  let dispatches = 0; let edits = 0; let rejectEdit = false;
  const worker = new VideoWorker(ledger, repository, storage, () => ({
    async generate(input, checkpoint) {
      dispatches++; expect(input.sourceImage.bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      await checkpoint({ interactionId: 'test-fixture-only', fileName: 'files/test-fixture', model: 'TEST-FIXTURE-NOT-GOOGLE' });
      return { bytes, mimeType: 'video/mp4', model: 'TEST-FIXTURE-NOT-GOOGLE', interactionId: 'test-fixture-only' };
    },
    async edit(input, checkpoint) {
      edits++; expect(input.interactionId).toBe('test-fixture-only');
      if (rejectEdit) throw new AiProviderError('AI_REQUEST_REJECTED', 'TEST FIXTURE rejected edit.');
      expect(input.prompt).toBe('TEST FIXTURE: make the square purple and move upward.');
      await checkpoint({ interactionId: 'test-revised-fixture', fileName: 'files/test-revised-fixture', model: 'TEST-FIXTURE-NOT-GOOGLE' });
      return { bytes: revised, mimeType: 'video/mp4', model: 'TEST-FIXTURE-NOT-GOOGLE', interactionId: 'test-revised-fixture' };
    },
    async editVideo() { throw new Error('No automatic upload fallback is allowed.'); },
    async resume() { throw new Error('No recovery expected in this browser test.'); },
  }));
  const video = new VideoService(ledger, () => ({ enqueue: async (key) => { queue.push(key); } }), storage, 3);
  const app = buildApp({ config: readConfig({ NODE_ENV: 'test', GOOGLE_CLOUD_PROJECT: 'demo-aniforge' }), repository, video, verifyToken: async (token) => { const uid = (await getAuth(admin).verifyIdToken(token, true)).uid; owners.add(uid); return uid; } });
  const origin = await app.listen({ port: 0, host: '127.0.0.1' });
  await page.route('**/api/v1/**', async (route) => { const url = new URL(route.request().url()); await route.fulfill({ response: await route.fetch({ url: `${origin}${url.pathname}${url.search}` }) }); });
  try {
    await page.goto('/projects'); await page.getByRole('button', { name: 'Continue as a guest' }).click();
    await page.getByRole('button', { name: 'New project', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Project name').fill('TEST FIXTURE video playback');
    const loaded = page.waitForResponse((response) => /\/api\/v1\/projects\/[^/]+\/scenes$/.test(response.url()));
    await page.getByRole('dialog').getByRole('button', { name: 'Create project', exact: true }).click();
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
    await page.getByRole('textbox', { name: 'Video edit instruction', exact: true }).fill('TEST FIXTURE: make the square purple and move upward.');
    await page.getByLabel(/I own or have permission to send this video/).check();
    await page.getByLabel(/I approve a paid video edit attempt/).check();
    await page.getByRole('button', { name: 'Create edited version', exact: true }).click();
    await expect.poll(() => queue.length).toBe(2);
    const editId = queue[1]!.jobId;
    await worker.execute(queue[1]!);
    await page.getByRole('button', { name: 'Refresh video status' }).click();
    const chooser = page.getByRole('combobox', { name: 'Video version', exact: true });
    await chooser.selectOption(editId);
    const parent = page.getByLabel('Parent animation', { exact: true });
    await expect(parent).toBeVisible();
    for (const player of [clip, parent]) {
      await expect.poll(() => player.evaluate((element) => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
      await player.evaluate(async (element) => { const video = element as HTMLVideoElement; video.muted = true; await video.play(); });
      await expect.poll(() => player.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(0.1);
      await player.evaluate((element) => (element as HTMLVideoElement).pause());
    }
    await page.getByRole('button', { name: 'Use this version', exact: true }).click();
    await page.getByRole('spinbutton', { name: 'Trim start (seconds)', exact: true }).fill('0.2');
    await page.getByRole('spinbutton', { name: 'Trim end (seconds, 0 = full clip)', exact: true }).fill('1.4');
    await page.getByRole('button', { name: 'Add caption', exact: true }).click();
    await page.getByRole('textbox', { name: 'Caption 1 text', exact: true }).fill('Test fixture caption');
    await page.getByRole('spinbutton', { name: 'Caption 1 start', exact: true }).fill('0.3');
    await page.getByRole('spinbutton', { name: 'Caption 1 end', exact: true }).fill('1.2');
    await expect.poll(async () => (await repository.scene(scene.projectId, scene.id))?.timeline.captions[0]?.text).toBe('Test fixture caption');
    await expect.poll(async () => (await repository.scene(scene.projectId, scene.id))?.timeline.captions[0]?.end).toBe(1.2);
    await expect(page.locator('.save-status.saved')).toBeVisible();
    await page.reload(); await expect(chooser).toHaveValue(editId);
    await expect(page.getByRole('spinbutton', { name: 'Trim start (seconds)', exact: true })).toHaveValue('0.2');
    await expect(page.getByRole('textbox', { name: 'Caption 1 text', exact: true })).toHaveValue('Test fixture caption');
    await expect.poll(() => clip.evaluate((element) => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
    await clip.evaluate((element) => { (element as HTMLVideoElement).currentTime = 0; });
    await expect.poll(() => clip.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeCloseTo(0.2, 2);
    await clip.evaluate((element) => { (element as HTMLVideoElement).currentTime = 0.5; });
    await expect(page.getByLabel('Preview captions', { exact: true })).toHaveText('Test fixture caption');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download original MP4', exact: true }).click();
    const download = await downloadPromise;
    expect(await readFile((await download.path())!)).toEqual(revised);
    await expect.poll(() => parent.evaluate((element) => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
    for (const player of [parent, clip]) {
      await player.evaluate(async (element) => { const video = element as HTMLVideoElement; video.currentTime = 0.4; video.muted = true; await video.play(); });
      await expect.poll(() => player.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(0.6);
      await player.evaluate((element) => { const video = element as HTMLVideoElement; video.pause(); video.currentTime = 0.5; });
    }
    for (const player of [parent, clip]) await expect.poll(() => player.evaluate((element) => !(element as HTMLVideoElement).seeking)).toBe(true);
    await chooser.focus();
    await page.getByRole('region', { name: 'Video versions and editing', exact: true }).screenshot({ path: testInfo.outputPath('test-fixture-revision-comparison.png') });
    await clip.evaluate(async (element) => { const video = element as HTMLVideoElement; video.currentTime = 1.3; video.muted = true; await video.play(); });
    await expect.poll(() => clip.evaluate((element) => (element as HTMLVideoElement).paused)).toBe(true);
    await expect.poll(() => clip.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeCloseTo(1.4, 2);
    await chooser.selectOption(queue[0]!.jobId);
    await page.getByRole('button', { name: 'Use this version', exact: true }).click();
    await expect.poll(async () => (await repository.scene(scene.projectId, scene.id))?.selectedVideoVersionId).toBe(queue[0]!.jobId);
    rejectEdit = true;
    await page.getByRole('textbox', { name: 'Video edit instruction', exact: true }).fill('TEST FIXTURE failed edit');
    await page.getByLabel(/I own or have permission to send this video/).check();
    await page.getByLabel(/I approve a paid video edit attempt/).check();
    await page.getByRole('button', { name: 'Create edited version', exact: true }).click();
    await expect.poll(() => queue.length).toBe(3); await worker.execute(queue[2]!);
    await page.getByRole('button', { name: 'Refresh video status' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'TEST FIXTURE rejected edit.' })).toBeVisible();
    expect(await video.content(scene.projectId, queue[0]!.jobId, owner)).toEqual(bytes);
    expect(await video.content(scene.projectId, editId, owner)).toEqual(revised);
    expect((await repository.scene(scene.projectId, scene.id))?.selectedVideoVersionId).toBe(queue[0]!.jobId);
    expect(dispatches).toBe(1); expect(edits).toBe(2); expect(errors).toEqual([]);
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
