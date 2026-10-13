import { expect, test } from '@playwright/test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import sharp from 'sharp';
import type { ApiEnvelope, Scene } from '@aniforge/shared';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../../apps/api/src/app.js';
import { readConfig } from '../../apps/api/src/config.js';
import { FirestoreProjectRepository } from '../../apps/api/src/repository.js';
import { CloudAssetStorage, projectStoragePrefix } from '../../apps/api/src/assets/storage.js';

if (process.env.ANIFORGE_EMULATOR_RUN !== 'true' || process.env.ANIFORGE_EMULATOR_PROFILE !== 'test' || process.env.GOOGLE_CLOUD_PROJECT !== 'demo-aniforge' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:19099' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18081' || process.env.FIREBASE_STORAGE_EMULATOR_HOST !== '127.0.0.1:19199') throw new Error('Homepage browser tests require the isolated local Firebase suite.');

test('dashboard manages real projects, private previews and explicitly scoped pagination', async ({ page, request }, testInfo) => {
  test.setTimeout(120_000);
  // A dedicated real API instance avoids sharing the production IP rate-limit
  // budget with unrelated browser scenarios. Firebase still uses real emulators.
  const admin = initializeApp({ projectId: 'demo-aniforge', storageBucket: 'demo-aniforge.appspot.com' }, `homepage-browser-${randomUUID()}`);
  const db = getFirestore(admin);
  const storage = new CloudAssetStorage(getStorage(admin), 'demo-aniforge.appspot.com');
  const owners = new Set<string>();
  const repository = new FirestoreProjectRepository(db, storage);
  const app = buildApp({ config: readConfig({ NODE_ENV: 'test', GOOGLE_CLOUD_PROJECT: 'demo-aniforge', GCS_BUCKET: 'demo-aniforge.appspot.com' }), repository, verifyToken: async (token) => { const uid = (await getAuth(admin).verifyIdToken(token, true)).uid; owners.add(uid); return uid; } });
  const apiOrigin = await app.listen({ port: 0, host: '127.0.0.1' });
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: `${apiOrigin}${url.pathname}${url.search}` });
    await route.fulfill({ response });
  });
  try {
    const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/projects');
    await page.getByRole('button', { name: 'Continue as a guest' }).click();
    await expect(page.getByRole('heading', { name: 'A blank slate. All yours.' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('dashboard-empty.png'), fullPage: true });
    await page.getByRole('button', { name: 'Dismiss getting started' }).click();
    await expect(page.getByRole('complementary', { name: 'Getting started' })).not.toBeVisible();
    await page.getByRole('button', { name: 'Getting started', exact: true }).click();
    await page.getByRole('button', { name: 'New project', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Project name').fill('Moonlit study');
    await page.screenshot({ path: testInfo.outputPath('dashboard-create.png'), fullPage: true });
    const opened = page.waitForResponse((response) => /\/api\/v1\/projects\/[^/]+\/scenes$/.test(response.url()));
    await dialog.getByRole('button', { name: 'Create project', exact: true }).click();
    const response = await opened;
    const scene = ((await response.json()) as ApiEnvelope<Scene[]>).data![0]!;
    const authorization = (await response.request().headerValue('authorization'))!;
    const owner = [...owners][0]!;
    await expect(page.getByTestId('scene-canvas')).toHaveAttribute('aria-label', 'Editable scene canvas with 0 objects');
    const thumbnailSaved = page.waitForResponse((res) => res.request().method() === 'POST' && res.url().includes('/thumbnail?'));
    await page.getByRole('button', { name: 'Add rectangle', exact: true }).click();
    expect((await thumbnailSaved).status()).toBe(200);
    const thumbPath = `${apiOrigin}/api/v1/projects/${scene.projectId}/thumbnail`;
    const preview = await request.get(thumbPath, { headers: { authorization } });
    expect(preview.status()).toBe(200); expect(preview.headers()['cache-control']).toBe('private, no-store');
    const bytes = await preview.body(); const metadata = await sharp(bytes).metadata();
    expect([metadata.width, metadata.height]).toEqual([480,270]);
    expect((await request.get(thumbPath)).status()).toBe(401);
    const stranger = await request.post('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-emulator-only', { data: { returnSecureToken: true } });
    const strangerToken = (await stranger.json() as { idToken: string }).idToken;
    expect((await request.get(thumbPath, { headers: { authorization: `Bearer ${strangerToken}` } })).status()).toBe(404);
    const uploadPath = `${apiOrigin}/api/v1/projects/${scene.projectId}/scenes/${scene.id}/thumbnail?revision=0`;
    expect((await request.post(uploadPath, { headers: { authorization, 'content-type': 'image/png' }, data: bytes })).status()).toBe(409);
    expect((await request.post(uploadPath, { headers: { authorization, 'content-type': 'image/png' }, data: Buffer.from('not an image') })).status()).toBe(400);
    expect((await request.post(uploadPath, { headers: { authorization: `Bearer ${strangerToken}`, 'content-type': 'image/png' }, data: bytes })).status()).toBe(404);
    await page.getByRole('button', { name: 'Back to projects' }).click();
    await expect(page.getByRole('img', { name: 'Saved source preview for Moonlit study' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('dashboard-populated.png'), fullPage: true });
    await page.locator('summary').filter({ hasText: 'Actions for Moonlit study' }).click();
    await page.getByRole('button', { name: 'Rename Moonlit study', exact: true }).click();
    await dialog.getByLabel('Project name').fill('Observatory sketch');
    await dialog.getByRole('button', { name: 'Save name' }).click();
    await expect(page.getByRole('button', { name: 'Open Observatory sketch' })).toBeVisible();
    await page.locator('summary').filter({ hasText: 'Actions for Observatory sketch' }).click();
    await page.getByRole('button', { name: 'Duplicate Observatory sketch', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Open Observatory sketch (copy)', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'List', exact: true }).click();
    await expect(page.getByRole('button', { name: 'List', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: testInfo.outputPath('dashboard-list.png'), fullPage: true });
    await page.locator('summary').filter({ hasText: 'Actions for Observatory sketch (copy)' }).click();
    await page.getByRole('button', { name: 'Delete Observatory sketch (copy)', exact: true }).click();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Open Observatory sketch (copy)', exact: true })).toBeVisible();
    await page.locator('summary').filter({ hasText: 'Actions for Observatory sketch (copy)' }).click();
    await page.getByRole('button', { name: 'Delete Observatory sketch (copy)', exact: true }).click();
    await dialog.getByRole('button', { name: 'Delete project', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Open Observatory sketch (copy)', exact: true })).not.toBeVisible();
    await page.getByRole('button', { name: 'Open Observatory sketch', exact: true }).click();
    await expect(page.getByTestId('scene-canvas')).toHaveAttribute('aria-label', 'Editable scene canvas with 1 objects');
    await page.reload();
    await expect(page.getByTestId('scene-canvas')).toHaveAttribute('aria-label', 'Editable scene canvas with 1 objects');
    await page.getByRole('button', { name: 'Back to projects' }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('button', { name: 'New project', exact: true })).toBeEnabled();
    await expect(page.getByRole('img', { name: 'Saved source preview for Observatory sketch' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('dashboard-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    // Seed genuine owned documents to cross the production 25-item page boundary.
    const seeded = await Promise.all(Array.from({ length: 26 }, (_, i) => repository.create(owner, `Study ${String(i).padStart(2,'0')}`, '')));
    const firstPage = await repository.list(owner, { limit: 25 });
    const beyond = seeded.find((project) => !firstPage.items.some((item) => item.id === project.id))!;
    const galleryReads: string[] = [];
    page.on('request', (req) => { if (/\/scenes(?:\?|$)/.test(req.url())) galleryReads.push(req.url()); });
    await page.getByRole('button', { name: 'Refresh projects' }).click();
    await expect(page.getByText('25 loaded', { exact: true })).toBeVisible();
    await page.getByLabel('Search loaded projects').fill(beyond.title);
    await expect(page.getByRole('heading', { name: 'No loaded projects match' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('dashboard-partial-search.png'), fullPage: true });
    await page.getByRole('button', { name: 'Load more projects' }).click();
    await expect(page.getByRole('button', { name: `Open ${beyond.title}`, exact: true })).toBeVisible();
    await expect(page.getByText('27 loaded', { exact: true })).toBeVisible();
    expect(galleryReads).toEqual([]);
    await page.getByLabel('Search loaded projects').fill('');
    await page.getByLabel('Sort loaded projects').selectOption('title');
    const titles = await page.locator('.af-library-info h2').allTextContents();
    expect(titles).toEqual([...titles].sort((a,b) => a.localeCompare(b)));
    await page.locator('summary').filter({ hasText: /^Account$/ }).click();
    page.once('dialog', (dialog) => { void dialog.dismiss(); });
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Your projects/ })).toBeVisible();
    await page.locator('summary').filter({ hasText: /^Account$/ }).click();
    page.once('dialog', (dialog) => { void dialog.accept(); });
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(page.locator('.af-library-card')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    if (!page.isClosed()) await page.unrouteAll({ behavior: 'wait' }).catch(() => { /* Continue server cleanup after browser teardown. */ });
    await app.close();
    for (const owner of owners) {
      const projects = await db.collection('projects').where('ownerId', '==', owner).get();
      for (const project of projects.docs) { await storage.removePrefix(projectStoragePrefix(owner, project.id)); await db.recursiveDelete(project.ref); }
    }
    await deleteApp(admin);
  }
});
