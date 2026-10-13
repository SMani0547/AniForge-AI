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
  test.setTimeout(120_000);
  const admin = initializeApp({ projectId: 'demo-aniforge', storageBucket: 'demo-aniforge.appspot.com' }, `video-browser-${randomUUID()}`);
  const db = getFirestore(admin); const storage = new CloudAssetStorage(getStorage(admin), 'demo-aniforge.appspot.com');
  const repository = new FirestoreProjectRepository(db, storage); const ledger = new VideoLedger(db);
  const queue: JobKey[] = []; const owners = new Set<string>(); const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const bytes = await readFile(new URL('../fixtures/original-square-test-only.mp4', import.meta.url));
  const revised = await readFile(new URL('../fixtures/revised-square-test-only.mp4', import.meta.url));
  let dispatches = 0; let edits = 0; let rejectEdit = false;
  let mediaReads = 0;
  page.on('request', (request) => { if (/\/versions\/[^/]+\/content$/.test(request.url())) mediaReads++; });
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
  const video = new VideoService(ledger, () => ({ enqueue: async (key) => { if (!queue.some((item) => item.jobId === key.jobId)) queue.push(key); } }), storage, 3);
  const app = buildApp({ config: readConfig({ NODE_ENV: 'test', GOOGLE_CLOUD_PROJECT: 'demo-aniforge' }), repository, video, verifyToken: async (token) => { const uid = (await getAuth(admin).verifyIdToken(token, true)).uid; owners.add(uid); return uid; } });
  const origin = await app.listen({ port: 0, host: '127.0.0.1' });
  let loseAcknowledgement = true;
  const generationIds: string[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request(); const url = new URL(request.url());
    const response = await route.fetch({ url: `${origin}${url.pathname}${url.search}` });
    if (url.pathname.endsWith('/generate') && request.method() === 'POST') {
      generationIds.push((request.postDataJSON() as { jobId: string }).jobId);
      // The real API reserved the job. Simulate only loss of its acknowledgement.
      if (loseAcknowledgement) { loseAcknowledgement = false; await route.abort('failed'); return; }
    }
    await route.fulfill({ response });
  });
  try {
    await page.goto('/projects'); await page.getByRole('button', { name: 'Continue as a guest' }).click();
    await page.getByRole('button', { name: 'New project', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Project name').fill('TEST FIXTURE video playback');
    const loaded = page.waitForResponse((response) => /\/api\/v1\/projects\/[^/]+\/scenes$/.test(response.url()));
    await page.getByRole('dialog').getByRole('button', { name: 'Create project', exact: true }).click();
    const scene = ((await (await loaded).json()) as ApiEnvelope<Scene[]>).data![0]!;
    const owner = [...owners][0]!;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: 'Video', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your first clip starts here' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generate animation', exact: true })).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath('video-empty.png'), fullPage: true });
    await page.getByRole('button', { name: 'Plan an animation', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Create manual shot plan' })).toBeVisible();
    await page.getByRole('button', { name: 'Properties', exact: true }).click();
    // Seed a reviewed manual plan through the real repository; the generation flow itself is all browser UI.
    await repository.updateScene(scene.projectId, scene.id, owner, { expectedRevision: scene.revision, shotPlan: analysisFixturePlan });
    await page.reload(); await page.getByRole('button', { name: 'Show video panel', exact: true }).click();
    await page.getByRole('button', { name: 'Add rectangle', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Video generation', exact: true });
    await panel.getByLabel('I own or have permission to send this scene to Google for video generation.').check();
    await panel.getByLabel('I approve a paid video attempt. Failure or timeout may still incur Google API charges.').check();
    await expect(panel.getByRole('button', { name: 'Generate animation', exact: true })).toBeDisabled();
    await panel.getByLabel('I reviewed this shot plan and animation prompt.').check();
    await panel.getByLabel('I approve a paid video attempt. Failure or timeout may still incur Google API charges.').check();
    await panel.getByRole('button', { name: 'Generate animation', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Retry same video request', exact: true })).toBeVisible();
    await expect.poll(() => queue.length).toBe(1);
    await panel.getByRole('button', { name: 'Retry same video request', exact: true }).click();
    await expect.poll(() => generationIds).toEqual([queue[0]!.jobId, queue[0]!.jobId]);
    await expect(panel.getByText('Queued', { exact: true })).toBeVisible();
    expect(queue).toHaveLength(1); expect(dispatches).toBe(0);
    await expect(page.getByRole('button', { name: 'Add rectangle', exact: true })).toBeEnabled();
    const queuedRevision = (await ledger.get(queue[0]!, owner)).sourceRevision;
    await page.getByRole('button', { name: 'Add ellipse', exact: true }).click();
    await expect.poll(async () => (await repository.scene(scene.projectId, scene.id))!.revision).toBeGreaterThan(queuedRevision);
    expect((await ledger.get(queue[0]!, owner)).sourceRevision).toBe(queuedRevision);
    await page.getByRole('button', { name: 'Video', exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath('video-queued.png'), fullPage: true });
    await page.reload(); await page.getByRole('button', { name: 'Show video panel', exact: true }).click(); await expect(panel.getByText('Queued', { exact: true })).toBeVisible();
    await worker.execute(queue[0]!);
    await panel.getByRole('button', { name: 'Refresh video status' }).click();
    await expect(panel.getByText('Completed', { exact: true })).toBeVisible();
    const clip = page.getByLabel('Generated animation', { exact: true });
    await expect(clip).toBeVisible();
    await expect.poll(() => clip.evaluate((element) => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
    await clip.evaluate(async (element) => { const video = element as HTMLVideoElement; video.muted = true; await video.play(); });
    await expect.poll(() => clip.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(0.1);
    await panel.getByLabel('I own or have permission to send this scene to Google for video generation.').check();
    await page.getByRole('button', { name: 'Hide video panel', exact: true }).click();
    await expect.poll(() => clip.evaluate((element) => (element as HTMLVideoElement).paused)).toBe(true);
    await page.getByRole('button', { name: 'Video', exact: true }).click();
    await expect(panel.getByLabel('I own or have permission to send this scene to Google for video generation.')).toBeChecked();
    expect(queue).toHaveLength(1);
    await page.screenshot({ path: testInfo.outputPath('test-fixture-video-player.png'), fullPage: true });
    await page.reload();
    const readsAfterReload = mediaReads;
    await expect(page.getByTestId('scene-canvas')).toBeVisible();
    // Hidden panels are excluded from accessibility queries; inspect mounted state directly.
    await expect(page.locator('#scene-video-panel .video-version-workspace > label select')).toHaveValue(queue[0]!.jobId);
    expect(mediaReads).toBe(readsAfterReload);
    await page.getByRole('button', { name: 'Show video panel', exact: true }).click(); await expect(clip).toBeVisible();
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
    await parent.evaluate(async (element) => { const video = element as HTMLVideoElement; video.muted = true; await video.play(); });
    await page.getByRole('button', { name: 'Compare with parent', exact: true }).click();
    await expect(parent).not.toBeVisible();
    await expect.poll(() => parent.evaluate((element) => (element as HTMLVideoElement).paused)).toBe(true);
    await page.getByRole('button', { name: 'Compare with parent', exact: true }).click();
    await expect(parent).toBeVisible();
    expect(edits).toBe(1);
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
    await page.reload(); await page.getByRole('button', { name: 'Show video panel', exact: true }).click(); await expect(chooser).toHaveValue(editId);
    await expect(page.getByRole('spinbutton', { name: 'Trim start (seconds)', exact: true })).toHaveValue('0.2');
    await expect(page.getByRole('textbox', { name: 'Caption 1 text', exact: true })).toHaveValue('Test fixture caption');
    await expect.poll(() => clip.evaluate((element) => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
    await clip.evaluate((element) => { (element as HTMLVideoElement).currentTime = 0; });
    await expect.poll(() => clip.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeCloseTo(0.2, 2);
    const playhead = page.getByRole('slider', { name: 'Preview playhead (seconds)', exact: true });
    await playhead.focus(); await playhead.press('Home');
    for (let step = 0; step < 30; step++) await playhead.press('ArrowRight');
    await expect.poll(() => clip.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeCloseTo(0.5, 2);
    await expect(page.getByLabel('Preview captions', { exact: true })).toHaveText('Test fixture caption');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download original MP4', exact: true }).click();
    const download = await downloadPromise;
    expect(await readFile((await download.path())!)).toEqual(revised);
    const jsonDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download editable timeline JSON', exact: true }).click();
    const exported = JSON.parse(await readFile((await (await jsonDownload).path())!, 'utf8')) as { versionId: string; timeline: unknown; rendering: string };
    expect(exported.versionId).toBe(editId);
    expect(exported.timeline).toEqual((await repository.scene(scene.projectId, scene.id))!.timeline);
    expect(exported.rendering).toContain('MP4 is unchanged');
    await playhead.focus(); await playhead.press('Home');
    await expect.poll(() => clip.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeCloseTo(0.2, 2);
    await playhead.press('End');
    await expect.poll(() => clip.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeCloseTo(1.4, 2);
    await expect.poll(() => parent.evaluate((element) => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
    for (const player of [parent, clip]) {
      await player.evaluate(async (element) => { const video = element as HTMLVideoElement; video.currentTime = 0.4; video.muted = true; await video.play(); });
      await expect.poll(() => player.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(0.6);
      await player.evaluate((element) => { const video = element as HTMLVideoElement; video.pause(); video.currentTime = 0.5; });
    }
    for (const player of [parent, clip]) await expect.poll(() => player.evaluate((element) => !(element as HTMLVideoElement).seeking)).toBe(true);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole('button', { name: 'Video', exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath('video-review-1280.png') });
    await page.locator('.video-comparison').screenshot({ path: testInfo.outputPath('video-comparison.png') });
    for (const width of [768, 720]) {
      await page.setViewportSize({ width, height: width === 720 ? 450 : 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath(`video-review-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.video-comparison').screenshot({ path: testInfo.outputPath('video-mobile-comparison.png') });
    await page.getByRole('group', { name: 'Trim & captions', exact: true }).screenshot({ path: testInfo.outputPath('video-mobile-timeline.png') });
    await page.getByRole('region', { name: 'Download video and timeline' }).screenshot({ path: testInfo.outputPath('video-mobile-downloads.png') });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath('video-review-1440.png') });
    await chooser.evaluate((element) => (element as HTMLSelectElement).focus({ preventScroll: true }));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath('test-fixture-revision-comparison.png'), fullPage: true });
    await clip.evaluate(async (element) => { const video = element as HTMLVideoElement; video.currentTime = 1.3; video.muted = true; await video.play(); });
    await expect.poll(() => clip.evaluate((element) => (element as HTMLVideoElement).paused)).toBe(true);
    await expect.poll(() => clip.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeCloseTo(1.4, 2);
    await page.getByRole('button', { name: 'Preview edited version ' + editId.slice(0, 8), exact: true }).click();
    await expect(page.getByRole('spinbutton', { name: 'Trim start (seconds)', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Preview original version ' + queue[0]!.jobId.slice(0, 8), exact: true }).click();
    expect((await repository.scene(scene.projectId, scene.id))?.selectedVideoVersionId).toBe(editId);
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
    await page.getByRole('region', { name: 'Generation activity', exact: true }).screenshot({ path: testInfo.outputPath('video-failed-edit.png') });
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
