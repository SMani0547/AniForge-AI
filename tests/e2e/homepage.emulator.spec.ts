import { expect, test } from '@playwright/test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../../apps/api/src/app.js';
import { readConfig } from '../../apps/api/src/config.js';
import { FirestoreProjectRepository } from '../../apps/api/src/repository.js';
import { CloudAssetStorage, projectStoragePrefix } from '../../apps/api/src/assets/storage.js';

if (process.env.ANIFORGE_EMULATOR_RUN !== 'true' || process.env.ANIFORGE_EMULATOR_PROFILE !== 'test' || process.env.GOOGLE_CLOUD_PROJECT !== 'demo-aniforge' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:19099' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18081' || process.env.FIREBASE_STORAGE_EMULATOR_HOST !== '127.0.0.1:19199') throw new Error('Homepage browser tests require the isolated local Firebase suite.');

test('public homepage reaches configured projects and a blank saved editor without generation', async ({ page }) => {
  // A dedicated real API instance avoids sharing the production IP rate-limit
  // budget with unrelated browser scenarios. Firebase still uses real emulators.
  const admin = initializeApp({ projectId: 'demo-aniforge', storageBucket: 'demo-aniforge.appspot.com' }, `homepage-browser-${randomUUID()}`);
  const db = getFirestore(admin);
  const storage = new CloudAssetStorage(getStorage(admin), 'demo-aniforge.appspot.com');
  const owners = new Set<string>();
  const app = buildApp({ config: readConfig({ NODE_ENV: 'test', GOOGLE_CLOUD_PROJECT: 'demo-aniforge', GCS_BUCKET: 'demo-aniforge.appspot.com' }), repository: new FirestoreProjectRepository(db, storage), verifyToken: async (token) => { const uid = (await getAuth(admin).verifyIdToken(token, true)).uid; owners.add(uid); return uid; } });
  const apiOrigin = await app.listen({ port: 0, host: '127.0.0.1' });
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: `${apiOrigin}${url.pathname}${url.search}` });
    await route.fulfill({ response });
  });
  try {
  const privateRequests: string[] = [];
  const observe = (request: { url: () => string }) => { if (/\/api\/v1|identitytoolkit|firestore|firebase-auth/.test(request.url())) privateRequests.push(request.url()); };
  page.on('request', observe);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your sketch.Your story.In motion.');
  expect(privateRequests).toEqual([]);
  page.off('request', observe);
  await page.getByRole('link', { name: 'Open studio', exact: true }).first().click();
  await page.getByRole('button', { name: 'Continue as a guest' }).click();
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Project name').fill('Homepage entry test');
  await dialog.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page.getByTestId('scene-canvas')).toHaveAttribute('aria-label', 'Editable scene canvas with 0 objects');
  await page.getByRole('button', { name: 'Show video panel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Generate animation' })).toBeDisabled();
  await page.getByRole('button', { name: 'AniForge home' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your sketch.Your story.In motion.');
  await page.getByRole('link', { name: 'Try drawing', exact: true }).first().click();
  await expect(page.getByTestId('sketch-canvas')).toBeVisible();
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
