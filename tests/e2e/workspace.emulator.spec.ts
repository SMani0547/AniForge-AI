import { expect, test } from '@playwright/test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import type { ApiEnvelope, Scene } from '@aniforge/shared';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../../apps/api/src/app.js';
import { readConfig } from '../../apps/api/src/config.js';
import { FirestoreProjectRepository } from '../../apps/api/src/repository.js';
import { CloudAssetStorage, projectStoragePrefix } from '../../apps/api/src/assets/storage.js';

if (process.env.ANIFORGE_EMULATOR_RUN !== 'true' || process.env.ANIFORGE_EMULATOR_PROFILE !== 'test' || process.env.GOOGLE_CLOUD_PROJECT !== 'demo-aniforge' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:19099' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18081' || process.env.FIREBASE_STORAGE_EMULATOR_HOST !== '127.0.0.1:19199') throw new Error('Workspace browser tests require the isolated local Firebase suite.');

test('workspace preserves drafts across views and canonical drawing through desktop and phone panels', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const admin = initializeApp({ projectId: 'demo-aniforge', storageBucket: 'demo-aniforge.appspot.com' }, `workspace-browser-${randomUUID()}`);
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
    let paidRequests = 0; let availabilityRequests = 0;
    page.on('request', (request) => {
      if (/\/(analyze|generate|edit)$/.test(request.url()) && request.method() === 'POST') paidRequests++;
      if (/\/ai\/(analysis|video)-status$/.test(request.url())) availabilityRequests++;
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/projects');
    await page.getByRole('button', { name: 'Continue as a guest' }).click();
    await page.getByRole('button', { name: 'New project', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'New project', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await page.getByLabel('Project name').fill('Original motion study');
    await page.getByRole('button', { name: 'Create project', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Close dialog', exact: true })).toBeFocused();
    const loaded = page.waitForResponse((response) => /\/projects\/[^/]+\/scenes$/.test(response.url()));
    await page.getByRole('button', { name: 'Create project', exact: true }).click();
    const scene = ((await (await loaded).json()) as ApiEnvelope<Scene[]>).data![0]!;
    const canvas = page.getByTestId('scene-canvas');
    const button = (name: string) => page.getByRole('button', { name, exact: true });
    const saved = async () => {
      if (await button('Save scene').isEnabled()) await button('Save scene').click();
      await expect(page.locator('.save-status.saved')).toBeVisible();
      return (await repository.scene(scene.projectId, scene.id))!;
    };
    const capture = async (name: string) => {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath(name), fullPage: true });
    };
    const noOverflow = async () => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const nav = page.getByRole('navigation', { name: 'Studio navigation' });
      if (await nav.isVisible()) {
        const header = (await page.locator('.af-editor-app .af-library-header').boundingBox())!;
        const box = (await nav.boundingBox())!;
        expect(box.y + box.height).toBeLessThanOrEqual(header.y + header.height + 1);
      }
    };
    await expect(canvas).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Studio navigation' })).toBeVisible();
    const account = page.locator('summary').filter({ hasText: /^Account$/ });
    await account.click();
    await expect(button('Sign out')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(account).toBeFocused();
    await expect(button('Sign out')).not.toBeVisible();
    const help = page.locator('summary').filter({ hasText: 'Shortcuts & help' });
    await help.focus(); await page.keyboard.press('Enter');
    await expect(page.getByText('V Select / P Pencil / B Brush / E Eraser / H Pan / F Fit / Esc Deselect')).toBeVisible();
    await page.keyboard.press('Escape'); await expect(help).toBeFocused();
    await expect(page.getByText('V Select / P Pencil / B Brush / E Eraser / H Pan / F Fit / Esc Deselect')).not.toBeVisible();
    await button('Import image').click();
    await expect(page.getByRole('dialog', { name: 'Import an original image' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(button('Import image')).toBeFocused();
    await capture('workspace-empty-1440.png');
    await button('Add rectangle').click();
    await page.getByLabel('Width', { exact: true }).fill('850');
    await page.getByLabel('Height', { exact: true }).fill('450');
    await button('Add ellipse').click();
    await page.getByLabel('X position', { exact: true }).fill('1050');
    await page.getByLabel('Y position', { exact: true }).fill('550');
    await button('Lower layer 2').click();
    await expect(button('Raise layer 1')).toBeEnabled();
    await button('Raise layer 1').click();
    await saved();
    await capture('workspace-source-1440.png');
    await noOverflow();
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }]) {
      await page.setViewportSize(viewport);
      await button('Fit canvas').click();
      await button('Pencil').click();
      const box = (await canvas.boundingBox())!;
      expect(box.width).toBeGreaterThan(550);
      expect(box.y + box.height).toBeLessThan(viewport.height);
      await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.75);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.8, { steps: 5 });
      await page.mouse.up();
      const stroke = (await saved()).canvas.objects.at(-1)!;
      expect(stroke.type).toBe('brushStroke');
      if (stroke.type === 'brushStroke') {
        expect(stroke.x + stroke.points[0]!).toBeCloseTo(480, -1);
        expect(stroke.y + stroke.points[1]!).toBeCloseTo(810, -1);
      }
      await noOverflow();
    }
    await capture('workspace-source-1280.png');
    // One scene instance owns history even while video owns the screen.
    await button('Video').click();
    await expect(canvas).not.toBeVisible();
    await expect(button('Generate animation')).toBeDisabled();
    await page.getByLabel('I own or have permission to send this scene to Google for video generation.').check();
    await button('Source').click();
    await button('Undo').click();
    await expect(canvas).toHaveAttribute('aria-label', 'Editable scene canvas with 3 objects');
    await button('Redo').click();
    await expect(canvas).toHaveAttribute('aria-label', 'Editable scene canvas with 4 objects');
    await button('Shot plan').click();
    await expect(button('Analyze scene')).toBeDisabled();
    await expect(page.getByText('Scene analysis requires configured Firebase', { exact: false })).toBeVisible();
    await button('Create manual shot plan').click();
    await page.getByRole('textbox', { name: 'Scene summary', exact: true }).fill('Unsaved original direction');
    await page.getByRole('textbox', { name: 'Notes for Gemini', exact: true }).fill('Keep my pencil marks');
    expect(availabilityRequests).toBeGreaterThan(0);
    const statusCount = availabilityRequests;
    await button('Video').click();
    await expect(page.getByLabel('I own or have permission to send this scene to Google for video generation.')).toBeChecked();
    await button('Source').click();
    await expect(page.getByRole('textbox', { name: 'Scene summary', exact: true })).toHaveValue('Unsaved original direction');
    await expect(page.getByRole('textbox', { name: 'Notes for Gemini', exact: true })).toHaveValue('Keep my pencil marks');
    await expect(page.getByRole('button', { name: 'Download local scene', exact: true })).toBeVisible();
    expect(availabilityRequests).toBe(statusCount);
    expect(paidRequests).toBe(0);
    await page.getByRole('textbox', { name: 'Scene summary', exact: true }).scrollIntoViewIfNeeded();
    // Visually hidden fieldset legends must stay inside the scrollable inspector.
    expect(await page.evaluate(() => document.documentElement.scrollHeight - document.querySelector('main')!.getBoundingClientRect().bottom - scrollY)).toBeLessThanOrEqual(1);
    await capture('workspace-local-draft.png');
    const currentUrl = page.url();
    const historyLength = await page.evaluate(() => window.history.length);
    page.once('dialog', (dialog) => { void dialog.dismiss(); });
    await page.evaluate(() => window.history.back());
    await expect(page).toHaveURL(currentUrl);
    await expect.poll(() => page.evaluate(() => window.history.state.aniforgeIndex)).toBe(1);
    expect(await page.evaluate(() => window.history.length)).toBe(historyLength);
    await expect(page.getByRole('textbox', { name: 'Scene summary', exact: true })).toHaveValue('Unsaved original direction');
    page.once('dialog', (dialog) => { void dialog.accept(); });
    await button('Remove shot plan').click();
    await saved();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(canvas).toBeVisible();
    await capture('workspace-mobile-canvas.png');
    await button('Tools & layers').click();
    await button('Add text').click();
    await capture('workspace-mobile-tools.png');
    await button('Inspector').click();
    await button('Properties').click();
    await page.getByLabel('Text content').fill('Original study v p b e h f');
    await page.getByLabel('Text content').press('ControlOrMeta+z');
    await page.getByLabel('Text content').fill('Original study v p b e h f');
    await page.getByLabel('Font size', { exact: true }).fill('70');
    await page.getByLabel('X position', { exact: true }).fill('250');
    await noOverflow();
    await capture('workspace-mobile-properties.png');
    await button('Canvas').click();
    await button('Fit canvas').click();
    await page.keyboard.press('p');
    await canvas.scrollIntoViewIfNeeded();
    const phoneBox = (await canvas.boundingBox())!;
    await page.mouse.move(phoneBox.x + phoneBox.width * 0.3, phoneBox.y + phoneBox.height * 0.7);
    await page.mouse.down();
    await page.mouse.move(phoneBox.x + phoneBox.width * 0.7, phoneBox.y + phoneBox.height * 0.7, { steps: 5 });
    await page.mouse.up();
    let savedDocument = await saved();
    expect(savedDocument.canvas.objects).toHaveLength(6);
    const last = savedDocument.canvas.objects.at(-1)!;
    if (last.type === 'brushStroke') { expect(last.x + last.points[0]!).toBeCloseTo(576, -1); expect(last.y + last.points[1]!).toBeCloseTo(756, -1); }
    else throw new Error('Phone stroke was not saved');
    await page.keyboard.press('ControlOrMeta+z');
    await expect(canvas).toHaveAttribute('aria-label', 'Editable scene canvas with 5 objects');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    savedDocument = await saved();
    await page.reload();
    await expect(canvas).toHaveAttribute('aria-label', 'Editable scene canvas with 6 objects');
    await button('Tools & layers').click();
    await page.getByRole('button', { name: /^Select layer 5:/ }).click();
    await button('Inspector').click();
    await expect(page.getByLabel('Text content')).toHaveValue('Original study v p b e h f');
    await expect(page.getByLabel('X position', { exact: true })).toHaveValue('250');
    expect((await repository.scene(scene.projectId, scene.id))!.canvas).toEqual(savedDocument.canvas);
    await button('Video').click();
    await noOverflow();
    await capture('workspace-mobile-video.png');
    for (const width of [768, 1280, 1440, 720]) {
      await page.setViewportSize({ width, height: width === 720 ? 450 : 900 });
      await noOverflow();
      await capture(`review-video-${width}.png`);
      await button('Source').click();
      if (width <= 1000) await button('Canvas').click();
      await noOverflow();
      await capture(`review-source-${width}.png`);
      if (width <= 1000) {
        for (const panel of ['Tools & layers', 'Inspector']) { await button(panel).click(); await noOverflow(); }
      }
      await button('Video').click();
    }
    await button('Back to projects').click();
    await expect(page.getByRole('heading', { name: /Your projects/ })).toBeVisible();
    await page.goBack();
    await expect(canvas).toHaveAttribute('aria-label', 'Editable scene canvas with 6 objects');
    await page.goForward();
    await expect(page.getByRole('heading', { name: /Your projects/ })).toBeVisible();
    for (const width of [390, 768, 1280, 1440, 720]) {
      await page.setViewportSize({ width, height: width === 720 ? 450 : 900 });
      await noOverflow(); await capture(`review-dashboard-${width}.png`);
    }
    expect(paidRequests).toBe(0);
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
