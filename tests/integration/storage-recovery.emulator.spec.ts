import { expect, test } from '@playwright/test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { randomUUID } from 'node:crypto';
import type { CanvasObject } from '@aniforge/shared';
import { FirestoreProjectRepository } from '../../apps/api/src/repository.js';
import { CloudAssetStorage, projectStoragePrefix, type AssetStorage } from '../../apps/api/src/assets/storage.js';
import { normalizeImage } from '../../apps/api/src/assets/images.js';
import { originalImage } from './fixture.js';

if (process.env.ANIFORGE_EMULATOR_RUN !== 'true' || process.env.ANIFORGE_EMULATOR_PROFILE !== 'test' || process.env.GOOGLE_CLOUD_PROJECT !== 'demo-aniforge' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18081' || process.env.FIREBASE_STORAGE_EMULATOR_HOST !== '127.0.0.1:19199') {
  throw new Error('Recovery tests require the isolated demo-aniforge emulator environment.');
}
const admin = initializeApp({ projectId: 'demo-aniforge', storageBucket: 'demo-aniforge.appspot.com' }, 'storage-recovery-verifier');
const db = getFirestore(admin); const bucket = getStorage(admin).bucket();
const realStorage = new CloudAssetStorage(getStorage(admin), bucket.name);
const owners = new Set<string>();

// Only failure timing is injected. Every successful read/write uses the real
// Firestore and Cloud Storage emulators with production repository code.
class FaultStorage implements AssetStorage {
  beforePut?: () => Promise<void>;
  afterPut?: () => Promise<void>;
  afterCopy?: () => Promise<void>;
  failRemove = false;
  failPurge = false;
  async put(path: string, bytes: Buffer) { await this.beforePut?.(); await realStorage.put(path, bytes); await this.afterPut?.(); }
  read(path: string) { return realStorage.read(path); }
  async copy(source: string, destination: string) { await realStorage.copy(source, destination); await this.afterCopy?.(); }
  async remove(path: string) { if (this.failRemove) { this.failRemove = false; throw new Error('Injected storage delete outage'); } await realStorage.remove(path); }
  async removePrefix(prefix: string) { if (this.failPurge) { this.failPurge = false; throw new Error('Injected project purge outage'); } await realStorage.removePrefix(prefix); }
}
function fixture() {
  const owner = `recovery-${randomUUID()}`; owners.add(owner);
  const storage = new FaultStorage(); const repository = new FirestoreProjectRepository(db, storage);
  return { owner, storage, repository };
}
async function imageProject(repository: FirestoreProjectRepository, owner: string) {
  const project = await repository.create(owner, 'Recovery test original', '');
  const scene = (await repository.scenes(project.id))[0]!;
  const asset = await repository.uploadAsset(project.id, scene.id, owner, await normalizeImage(originalImage(), 'image/png'));
  const image: CanvasObject = { type: 'image', id: randomUUID(), assetId: asset.id, crop: null, x: 10, y: 10, width: 640, height: 480, rotation: 0, opacity: 1, locked: false, hidden: false, zIndex: 0, fill: '#ffffff', stroke: '#000000', strokeWidth: 0 };
  const saved = await repository.updateScene(project.id, scene.id, owner, { expectedRevision: 0, canvas: { ...scene.canvas, objects: [image] } });
  return { project, scene: saved, asset, image };
}

test.afterEach(async () => {
  for (const owner of owners) {
    const projects = await db.collection('projects').where('ownerId', '==', owner).get();
    for (const doc of projects.docs) {
      await realStorage.removePrefix(projectStoragePrefix(owner, doc.id));
      await db.recursiveDelete(doc.ref);
    }
  }
  owners.clear();
});
test.afterAll(async () => { await deleteApp(admin); });

test('upload write failure retains a cleanup reservation until real storage deletion succeeds', async () => {
  const { repository, owner, storage } = fixture();
  const project = await repository.create(owner, 'Interrupted upload', '');
  storage.afterPut = async () => { throw new Error('Injected lost upload response'); };
  storage.failRemove = true;
  await expect(repository.uploadAsset(project.id, project.sceneOrder[0]!, owner, await normalizeImage(originalImage(), 'image/png'))).rejects.toThrow('Injected lost upload response');
  const assets = await db.collection(`projects/${project.id}/assets`).get();
  expect(assets.docs).toHaveLength(1); expect(assets.docs[0]!.data().state).toBe('cleanup');
  expect((await bucket.getFiles({ prefix: projectStoragePrefix(owner, project.id) }))[0]).toHaveLength(1);
  await repository.retryPendingCleanup();
  expect((await db.collection(`projects/${project.id}/assets`).get()).empty).toBe(true);
  expect((await bucket.getFiles({ prefix: projectStoragePrefix(owner, project.id) }))[0]).toHaveLength(0);
});

test('an upload finishing after project deletion cannot publish an asset or leave late media', async () => {
  const { repository, owner, storage } = fixture();
  const project = await repository.create(owner, 'Delete races upload', '');
  let started!: () => void; const writing = new Promise<void>((resolve) => { started = resolve; });
  let resume!: () => void; const barrier = new Promise<void>((resolve) => { resume = resolve; });
  storage.beforePut = async () => { started(); await barrier; };
  const upload = repository.uploadAsset(project.id, project.sceneOrder[0]!, owner, await normalizeImage(originalImage(), 'image/png')).then(() => null, (error: unknown) => error);
  await writing;
  await repository.remove(project.id, owner);
  resume();
  expect(await upload).toMatchObject({ statusCode: 404 });
  expect(await repository.get(project.id)).toBeNull();
  expect((await db.doc(`projects/${project.id}`).get()).data()).toMatchObject({ id: project.id, ownerId: owner, lifecycle: 'deleting' });
  expect((await db.doc(`projects/${project.id}`).get()).data()).not.toHaveProperty('title');
  expect((await bucket.getFiles({ prefix: projectStoragePrefix(owner, project.id) }))[0]).toHaveLength(0);
});

test('a partial copy and failed rollback remain hidden and are purged on retry without changing the source', async () => {
  const { repository, owner, storage } = fixture();
  const { project, scene, asset } = await imageProject(repository, owner);
  storage.afterCopy = async () => { throw new Error('Injected copy response failure'); }; storage.failPurge = true;
  await expect(repository.duplicate(project.id, owner)).rejects.toThrow('Injected copy response failure');
  expect((await repository.list(owner, { limit: 25 })).items.map((item) => item.id)).toEqual([project.id]);
  const docs = await db.collection('projects').where('ownerId', '==', owner).get();
  const hidden = docs.docs.find((doc) => doc.id !== project.id)!;
  expect(hidden.data().lifecycle).toBe('deleting');
  expect((await bucket.getFiles({ prefix: projectStoragePrefix(owner, hidden.id) }))[0]).toHaveLength(1);
  await repository.retryPendingCleanup();
  expect((await bucket.getFiles({ prefix: projectStoragePrefix(owner, hidden.id) }))[0]).toHaveLength(0);
  expect(await repository.scene(project.id, scene.id)).toEqual(scene);
  expect((await repository.assetContent(project.id, asset.id, owner)).length).toBeGreaterThan(0);
});

test('editing a source during media copy rejects publication and rolls back the target', async () => {
  const { repository, owner, storage } = fixture();
  const { project, scene } = await imageProject(repository, owner);
  storage.afterCopy = async () => { await repository.updateScene(project.id, scene.id, owner, { expectedRevision: scene.revision, title: 'A concurrent source edit' }); };
  await expect(repository.duplicate(project.id, owner)).rejects.toMatchObject({ statusCode: 409, code: 'PROJECT_CHANGED' });
  expect((await repository.list(owner, { limit: 25 })).items).toHaveLength(1);
  expect((await repository.scene(project.id, scene.id))!.title).toBe('A concurrent source edit');
  const files = (await bucket.getFiles({ prefix: `users/${owner}/projects/` }))[0];
  expect(files).toHaveLength(1); expect(files[0]!.name).toContain(`/projects/${project.id}/`);
});

test('failed project deletion is hidden immediately and owner retry cleans all private objects', async () => {
  const { repository, owner, storage } = fixture();
  const { project } = await imageProject(repository, owner);
  storage.failPurge = true;
  await expect(repository.remove(project.id, owner)).rejects.toThrow('Injected project purge outage');
  expect(await repository.get(project.id)).toBeNull();
  await expect(repository.remove(project.id, 'another-owner')).rejects.toMatchObject({ statusCode: 404 });
  await repository.remove(project.id, owner);
  expect((await bucket.getFiles({ prefix: projectStoragePrefix(owner, project.id) }))[0]).toHaveLength(0);
  expect((await db.collection(`projects/${project.id}/scenes`).get()).empty).toBe(true);
});

test('scene saves reject cross-project image references and crop overflow without changing revision', async () => {
  const { repository, owner } = fixture();
  const { project, scene, image } = await imageProject(repository, owner);
  const other = await repository.create(owner, 'Separate original', '');
  const target = (await repository.scenes(other.id))[0]!;
  await expect(repository.updateScene(other.id, target.id, owner, { expectedRevision: 0, canvas: { ...target.canvas, objects: [image] } })).rejects.toMatchObject({ statusCode: 404 });
  await expect(repository.updateScene(project.id, scene.id, owner, { expectedRevision: scene.revision, canvas: { ...scene.canvas, objects: [{ ...image, crop: { x: 60, y: 0, width: 10, height: 40 } }] } })).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_CROP' });
  expect((await repository.scene(project.id, scene.id))!.revision).toBe(scene.revision);
  expect((await repository.scene(other.id, target.id))!.revision).toBe(0);
});
