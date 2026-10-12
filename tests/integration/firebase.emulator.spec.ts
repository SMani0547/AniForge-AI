import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { randomUUID } from 'node:crypto';
import type { ApiEnvelope, Asset, CanvasObject, Project, ProjectPage, Scene } from '@aniforge/shared';
import { originalImage } from './fixture.js';

if (process.env.ANIFORGE_EMULATOR_RUN !== 'true' || process.env.GOOGLE_CLOUD_PROJECT !== 'demo-aniforge' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8081' || process.env.FIREBASE_STORAGE_EMULATOR_HOST !== '127.0.0.1:9199') {
  throw new Error('Integration tests require the isolated demo-aniforge emulator environment.');
}
const api = 'http://127.0.0.1:8080/api/v1';
const admin = initializeApp({ projectId: 'demo-aniforge', storageBucket: 'demo-aniforge.appspot.com' }, 'integration-verifier');
const db = getFirestore(admin);
const bucket = getStorage(admin).bucket();

async function identity(request: APIRequestContext) {
  const response = await request.post('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-emulator-only', { data: { returnSecureToken: true } });
  expect(response.status()).toBe(200);
  return await response.json() as { idToken: string; localId: string };
}
const headers = (token: string) => ({ authorization: `Bearer ${token}` });
async function data<T>(response: APIResponse, status = 200) {
  expect(response.status(), await response.text()).toBe(status);
  const body = await response.json() as ApiEnvelope<T>;
  expect(body.error).toBeNull();
  return body.data as T;
}
const baseObject = { x: 160, y: 130, width: 640, height: 480, rotation: 0, opacity: 1, locked: false, hidden: false, zIndex: 0, fill: '#4285f4', stroke: '#ffffff', strokeWidth: 2 };

test.afterAll(async () => { await deleteApp(admin); });

test('real Auth, Firestore and Storage enforce ownership and preserve independent duplicated media', async ({ request }) => {
  const owner = await identity(request); const stranger = await identity(request);
  const auth = headers(owner.idToken); const other = headers(stranger.idToken);
  expect((await request.get(`${api}/projects`)).status()).toBe(401);
  const project = await data<Project>(await request.post(`${api}/projects`, { headers: auth, data: { title: 'Original geometry integration' } }), 201);
  const projectUrl = `${api}/projects/${project.id}`;
  const scene = (await data<Scene[]>(await request.get(`${projectUrl}/scenes`, { headers: auth })))[0]!;
  const sceneUrl = `${projectUrl}/scenes/${scene.id}`;
  const asset = await data<Asset>(await request.post(`${projectUrl}/assets?sceneId=${scene.id}&copyrightAttested=true`, { headers: { ...auth, 'content-type': 'image/png' }, data: originalImage() }), 201);
  expect(asset).toMatchObject({ projectId: project.id, sceneId: scene.id, ownerId: owner.localId, mimeType: 'image/png', width: 64, height: 48, copyrightAttested: true });
  const image: CanvasObject = { ...baseObject, id: randomUUID(), type: 'image', assetId: asset.id, crop: { x: 8, y: 8, width: 48, height: 32 } };
  const stroke: CanvasObject = { ...baseObject, id: randomUUID(), type: 'brushStroke', zIndex: 1, width: 150, height: 80, tool: 'brush', points: [0, 0, 70, 35, 150, 80] };
  const saved = await data<Scene>(await request.patch(sceneUrl, { headers: auth, data: { expectedRevision: scene.revision, canvas: { ...scene.canvas, objects: [image, stroke] } } }));
  expect(saved.revision).toBe(scene.revision + 1);
  expect(saved.sourceAssetIds).toEqual([asset.id]);
  expect((await data<Scene>(await request.get(sceneUrl, { headers: auth }))).canvas.objects).toEqual([image, stroke]);
  const stale = await request.patch(sceneUrl, { headers: auth, data: { expectedRevision: scene.revision, title: 'Stale change' } });
  expect(stale.status()).toBe(409);
  expect((await stale.json()).error.code).toBe('SCENE_CONFLICT');

  const content = await request.get(`${projectUrl}/assets/${asset.id}/content`, { headers: auth });
  expect(content.status()).toBe(200);
  expect(content.headers()['content-type']).toContain('image/png');
  expect((await content.body()).subarray(0, 8)).toEqual(originalImage().subarray(0, 8));
  for (const path of ['', '/scenes', `/scenes/${scene.id}`, `/assets/${asset.id}`, `/assets/${asset.id}/content`]) {
    expect((await request.get(`${projectUrl}${path}`, { headers: other })).status()).toBe(404);
  }
  expect((await request.patch(sceneUrl, { headers: other, data: { expectedRevision: saved.revision, title: 'Intrusion' } })).status()).toBe(404);
  expect((await request.post(`${projectUrl}/assets?sceneId=${scene.id}&copyrightAttested=true`, { headers: { ...other, 'content-type': 'image/png' }, data: originalImage() })).status()).toBe(404);
  expect((await request.post(`${projectUrl}/duplicate`, { headers: other })).status()).toBe(404);
  expect((await request.delete(projectUrl, { headers: other })).status()).toBe(404);
  expect((await data<ProjectPage>(await request.get(`${api}/projects`, { headers: other }))).items).toEqual([]);

  // The direct browser SDK paths are denied too; the backend owns these stores.
  const directDocument = await request.get(`http://127.0.0.1:8081/v1/projects/demo-aniforge/databases/(default)/documents/projects/${project.id}`, { headers: auth });
  expect(directDocument.status()).toBe(403);
  const [originalFiles] = await bucket.getFiles({ prefix: `users/${owner.localId}/projects/${project.id}/` });
  expect(originalFiles.length).toBeGreaterThan(0);
  const directMedia = await request.get(`http://127.0.0.1:9199/v0/b/${bucket.name}/o/${encodeURIComponent(originalFiles[0]!.name)}?alt=media`);
  expect(directMedia.status()).toBe(403);

  const copy = await data<Project>(await request.post(`${projectUrl}/duplicate`, { headers: auth }), 201);
  const copyScene = (await data<Scene[]>(await request.get(`${api}/projects/${copy.id}/scenes`, { headers: auth })))[0]!;
  const copiedImage = copyScene.canvas.objects.find((object) => object.type === 'image');
  expect(copiedImage?.type).toBe('image');
  if (copiedImage?.type !== 'image') throw new Error('Duplicated image missing');
  expect(copiedImage.assetId).not.toBe(asset.id);
  expect(copiedImage.crop).toEqual(image.crop);
  const [copyFiles] = await bucket.getFiles({ prefix: `users/${owner.localId}/projects/${copy.id}/` });
  expect(copyFiles.length).toBeGreaterThan(0);
  expect(copyFiles.every((file) => !originalFiles.some((original) => original.name === file.name))).toBe(true);

  await data<null>(await request.delete(projectUrl, { headers: auth }));
  expect((await request.get(projectUrl, { headers: auth })).status()).toBe(404);
  expect((await request.get(`${projectUrl}/assets/${asset.id}/content`, { headers: auth })).status()).toBe(404);
  expect((await bucket.getFiles({ prefix: `users/${owner.localId}/projects/${project.id}/` }))[0]).toHaveLength(0);
  expect((await db.doc(`projects/${project.id}/scenes/${scene.id}`).get()).exists).toBe(false);
  const copyContent = await request.get(`${api}/projects/${copy.id}/assets/${copiedImage.assetId}/content`, { headers: auth });
  expect(copyContent.status()).toBe(200);
  expect(await copyContent.body()).toEqual(await content.body());
  await data<null>(await request.delete(`${api}/projects/${copy.id}`, { headers: auth }));
  expect((await bucket.getFiles({ prefix: `users/${owner.localId}/projects/${copy.id}/` }))[0]).toHaveLength(0);
});

test('concurrent scene writers get one committed edit and one recoverable conflict', async ({ request }) => {
  const owner = await identity(request); const auth = headers(owner.idToken);
  const project = await data<Project>(await request.post(`${api}/projects`, { headers: auth, data: { title: 'Concurrent writers' } }), 201);
  const sceneUrl = `${api}/projects/${project.id}/scenes/${project.sceneOrder[0]}`;
  const initial = await data<Scene>(await request.get(sceneUrl, { headers: auth }));
  const responses = await Promise.all(['Tab one', 'Tab two'].map((title) => request.patch(sceneUrl, { headers: auth, data: { expectedRevision: initial.revision, title } })));
  expect(responses.map((response) => response.status()).sort()).toEqual([200, 409]);
  const committed = await data<Scene>(responses.find((response) => response.status() === 200)!);
  expect(await data<Scene>(await request.get(sceneUrl, { headers: auth }))).toEqual(committed);
  expect(committed.revision).toBe(initial.revision + 1);
  await data<null>(await request.delete(`${api}/projects/${project.id}`, { headers: auth }));
});

test('project pagination reaches every item beyond 100 without exposing another owner', async ({ request }) => {
  const owner = await identity(request); const stranger = await identity(request);
  // Seed only this scalability fixture with the Admin SDK, avoiding the API's
  // intentional per-minute creation limit. All page reads use real bearer auth.
  const batch = db.batch(); const ids: string[] = [];
  for (let i = 0; i < 105; i += 1) {
    const id = randomUUID(); ids.push(id);
    batch.create(db.doc(`projects/${id}`), { id, ownerId: owner.localId, title: `Pagination ${i}`, description: '', aspectRatio: '16:9', sceneOrder: [], schemaVersion: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  await batch.commit();
  const found: string[] = []; let cursor: string | null = null; let firstCursor: string | null = null;
  for (let pageNumber = 0; pageNumber < 6; pageNumber += 1) {
    const query: string = `?limit=25${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const page: ProjectPage = await data<ProjectPage>(await request.get(`${api}/projects${query}`, { headers: headers(owner.idToken) }));
    found.push(...page.items.map((project) => project.id));
    expect(page.items.every((project) => project.ownerId === owner.localId)).toBe(true);
    cursor = page.nextCursor; firstCursor ??= cursor;
    if (!cursor) break;
  }
  expect(cursor).toBeNull();
  expect(found).toHaveLength(105);
  expect(new Set(found)).toEqual(new Set(ids));
  expect(firstCursor).not.toBeNull();
  expect((await request.get(`${api}/projects?cursor=${encodeURIComponent(firstCursor!)}`, { headers: headers(stranger.idToken) })).status()).toBe(400);
  const cleanup = db.batch(); for (const id of ids) cleanup.delete(db.doc(`projects/${id}`)); await cleanup.commit();
});
