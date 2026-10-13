import { expect, test, type Page } from '@playwright/test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { createHash, randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import type { ApiEnvelope, Scene } from '@aniforge/shared';
import { buildApp } from '../../apps/api/src/app.js';
import { readConfig } from '../../apps/api/src/config.js';
import { FirestoreProjectRepository } from '../../apps/api/src/repository.js';
import { CloudAssetStorage, projectStoragePrefix } from '../../apps/api/src/assets/storage.js';
import { SceneAnalysisService } from '../../apps/api/src/analysis.js';
import { FirestoreAnalysisLedger } from '../../apps/api/src/analysis-ledger.js';
import { AiProviderError } from '../../apps/api/src/ai/errors.js';
import type { SourceImage } from '../../apps/api/src/ai/input.js';
import { analysisFixturePlan } from '../integration/analysis-fixture.js';
import { originalImage } from '../integration/fixture.js';

if (process.env.ANIFORGE_EMULATOR_RUN !== 'true' || process.env.ANIFORGE_EMULATOR_PROFILE !== 'test' || process.env.GOOGLE_CLOUD_PROJECT !== 'demo-aniforge' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:19099' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18081' || process.env.FIREBASE_STORAGE_EMULATOR_HOST !== '127.0.0.1:19199') throw new Error('Analysis browser tests require the isolated local Firebase suite.');

async function openNewProject(page: Page, title: string) {
  await page.goto('/projects');
  await page.getByRole('button', { name: 'Continue as a guest' }).click();
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Project name').fill(title);
  const loading = page.waitForResponse((response) => /\/api\/v1\/projects\/[^/]+\/scenes$/.test(response.url()));
  await dialog.getByRole('button', { name: 'Create project', exact: true }).click();
  const response = await loading;
  const scene = ((await response.json()) as ApiEnvelope<Scene[]>).data![0]!;
  const authorization = (await response.request().headerValue('authorization'))!;
  return { scene, authorization, scenePath: `/api/v1/projects/${scene.projectId}/scenes/${scene.id}` };
}
async function save(page: Page) {
  const button = page.getByRole('button', { name: 'Save scene', exact: true });
  if (await button.isEnabled()) await button.click();
  await expect(page.getByRole('status').filter({ hasText: /^Saved .*revision \d+$/ })).toBeVisible();
}
async function fillPlan(page: Page) {
  const fields = { 'Scene summary': 'My original geometric scene', 'Action': 'A small upward movement', 'Environment': 'A dark background', 'Mood': 'Quiet', 'Animation prompt': 'Move my original blue rectangle gently upward.', 'Shot type': 'Wide', 'Camera movement': 'Static', 'Subject 1 name': 'Blue rectangle', 'Subject 1 appearance': 'A simple blue shape' };
  for (const [label, value] of Object.entries(fields)) await page.getByRole('textbox', { name: label, exact: true }).fill(value);
}

test('manual shot plans save and reload with real AI explicitly disabled', async ({ page }) => {
  let analyses = 0;
  page.on('request', (request) => { if (request.url().endsWith('/analyze')) analyses++; });
  const opened = await openNewProject(page, 'Manual direction without Gemini');
  await expect(page.getByText('Real AI is disabled.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Analyze scene', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Add rectangle', exact: true }).click();
  await save(page);
  await page.getByRole('button', { name: 'Create manual shot plan' }).click();
  await expect(page.getByText('Draft not yet valid:', { exact: false })).toBeVisible();
  await fillPlan(page);
  await save(page);
  const response = await page.request.get(opened.scenePath, { headers: { authorization: opened.authorization } });
  const saved = ((await response.json()) as ApiEnvelope<Scene>).data!;
  expect(saved.shotPlan?.sceneSummary).toBe('My original geometric scene');
  expect(saved.canvas.objects).toHaveLength(1);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Animation prompt', exact: true })).toHaveValue('Move my original blue rectangle gently upward.');
  await expect(page.getByTestId('scene-canvas')).toHaveAttribute('aria-label', 'Editable scene canvas with 1 objects');
  expect(analyses).toBe(0);
});

test('explicit provider fixture exercises canonical private snapshot, review, persistence and safe failure', async ({ page }, testInfo) => {
  // Only the model is replaced. Browser -> Fastify -> Auth/Firestore/Storage all
  // use actual application code and local emulators. This is not live AI evidence.
  const admin = initializeApp({ projectId: 'demo-aniforge', storageBucket: 'demo-aniforge.appspot.com' }, `analysis-browser-${randomUUID()}`);
  const db = getFirestore(admin); const storage = new CloudAssetStorage(getStorage(admin), 'demo-aniforge.appspot.com');
  const repository = new FirestoreProjectRepository(db, storage);
  const owners = new Set<string>(); const captured: Array<{ sourceImage: SourceImage; notes?: string }> = [];
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  let rejectNext = false;
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => { release = resolve; });
  const model = 'explicit-test-fixture-no-google-call';
  const analysis = new SceneAnalysisService(repository, new FirestoreAnalysisLedger(db), () => ({ model, provider: { async analyze(input) {
    captured.push(input);
    if (rejectNext) throw new AiProviderError('AI_BAD_ANALYSIS', 'Explicit invalid-provider-output test');
    await barrier;
    return { shotPlan: structuredClone(analysisFixturePlan), model, interactionId: 'server-only-test-interaction' };
  } } }), 20);
  const app = buildApp({ config: readConfig({ NODE_ENV: 'test', GOOGLE_CLOUD_PROJECT: 'demo-aniforge', GCS_BUCKET: 'demo-aniforge.appspot.com' }), repository, analysis, verifyToken: async (token) => { const uid = (await getAuth(admin).verifyIdToken(token, true)).uid; owners.add(uid); return uid; } });
  const apiOrigin = await app.listen({ port: 0, host: '127.0.0.1' });
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: `${apiOrigin}${url.pathname}${url.search}` });
    await route.fulfill({ response });
  });
  try {
    const opened = await openNewProject(page, 'Explicit analysis fixture project');
    await page.getByRole('button', { name: 'Add rectangle', exact: true }).click();
    await page.getByRole('button', { name: 'Import image', exact: true }).click();
    const importer = page.getByRole('dialog', { name: 'Import an original image' });
    await importer.getByLabel('Original image', { exact: true }).setInputFiles({ name: 'original-geometry.png', mimeType: 'image/png', buffer: originalImage() });
    await expect(importer.getByLabel('Crop width', { exact: true })).toHaveValue('64');
    await importer.getByLabel('Crop x', { exact: true }).fill('12');
    await importer.getByLabel('Crop y', { exact: true }).fill('10');
    await importer.getByLabel('Crop width', { exact: true }).fill('40');
    await importer.getByLabel('Crop height', { exact: true }).fill('28');
    await importer.getByLabel('I created this image or have permission to use and animate it.').check();
    await importer.getByRole('button', { name: 'Confirm crop and import' }).click();
    await expect(importer).not.toBeVisible();
    await page.getByLabel('X position', { exact: true }).fill('1000');
    await page.getByLabel('Y position', { exact: true }).fill('600');
    await page.getByLabel('Width', { exact: true }).fill('400');
    await page.getByLabel('Height', { exact: true }).fill('280');
    await page.getByRole('combobox', { name: 'Zoom', exact: true }).selectOption('0.5');
    await save(page);
    const original = await repository.scene(opened.scene.projectId, opened.scene.id);
    await expect(page.getByRole('button', { name: 'Analyze scene', exact: true })).toBeDisabled();
    await page.getByLabel('Notes for Gemini', { exact: true }).fill('TEST FIXTURE: retain the original colors');
    await page.getByLabel('I own this scene or have permission to send all its content to Google AI.').check();
    await page.getByLabel('I understand this analysis sends the scene and notes to Google AI and may incur API charges.').check();
    await page.getByRole('button', { name: 'Analyze scene', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Gemini is analyzing' })).toBeVisible();
    await expect.poll(() => captured.length).toBe(1);
    expect(captured[0]!.notes).toBe('TEST FIXTURE: retain the original colors');
    const png = captured[0]!.sourceImage.bytes;
    const { data: pixels, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([1920, 1080]);
    const pixel = (x: number, y: number) => [...pixels.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)];
    expect(pixel(20, 20)).toEqual([17, 24, 39]);
    expect(pixel(400, 250)).toEqual([117, 167, 255]);
    expect(pixel(1200, 700)).toEqual([69, 129, 244]);
    expect(pixel(1200, 550)).toEqual([17, 24, 39]);
    await writeFile(testInfo.outputPath('canonical-private-snapshot.png'), png);
    release();
    await expect(page.getByRole('region', { name: 'Gemini suggestion' })).toBeVisible();
    expect((await repository.scene(opened.scene.projectId, opened.scene.id))?.shotPlan).toBeNull();
    await page.getByRole('button', { name: 'Apply suggestion to shot plan' }).click();
    await page.getByRole('textbox', { name: 'Animation prompt', exact: true }).fill('My revised animation direction after reviewing the fixture.');
    await save(page);
    const saved = (await repository.scene(opened.scene.projectId, opened.scene.id))!;
    expect(saved.canvas).toEqual(original?.canvas);
    expect(saved.shotPlan?.animationPrompt).toBe('My revised animation direction after reviewing the fixture.');
    const records = await db.collection(`projects/${opened.scene.projectId}/analyses`).get();
    expect(records.docs).toHaveLength(1);
    expect(records.docs[0]!.data()).toMatchObject({ state: 'succeeded', interactionId: 'server-only-test-interaction' });
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Animation prompt', exact: true })).toHaveValue(saved.shotPlan!.animationPrompt);
    await page.getByRole('heading', { name: 'Shot plan', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('reviewed-test-fixture-plan.png'), fullPage: true });
    rejectNext = true;
    await page.getByLabel('I own this scene or have permission to send all its content to Google AI.').check();
    await page.getByLabel('I understand this analysis sends the scene and notes to Google AI and may incur API charges.').check();
    await page.getByRole('button', { name: 'Analyze scene', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'invalid shot plan' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Animation prompt', exact: true })).toHaveValue(saved.shotPlan!.animationPrompt);
    expect((await repository.scene(opened.scene.projectId, opened.scene.id))?.canvas).toEqual(saved.canvas);
    expect((await repository.scene(opened.scene.projectId, opened.scene.id))?.shotPlan).toEqual(saved.shotPlan);
    await page.getByRole('button', { name: 'Retry same analysis' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'invalid shot plan' })).toBeVisible();
    expect(captured).toHaveLength(2);
    expect(errors).toEqual([]);
  } finally {
    release();
    if (!page.isClosed()) await page.unrouteAll({ behavior: 'wait' }).catch(() => { /* Browser teardown must not skip server cleanup. */ });
    await app.close();
    for (const owner of owners) {
      const projects = await db.collection('projects').where('ownerId', '==', owner).get();
      for (const project of projects.docs) { await storage.removePrefix(projectStoragePrefix(owner, project.id)); await db.recursiveDelete(project.ref); }
      await db.collection('analysisUsage').doc(createHash('sha256').update(owner).digest('hex')).delete();
    }
    await deleteApp(admin);
  }
});
