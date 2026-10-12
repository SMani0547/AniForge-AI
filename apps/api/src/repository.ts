import { randomUUID } from 'node:crypto';
import { FieldPath, type Firestore, type Transaction, type DocumentReference, type DocumentData } from 'firebase-admin/firestore';
import { assetSchema, emptyScene, projectSchema, sceneSchema, type Asset, type Project, type ProjectPage, type ProjectUpdate, type Scene, type SceneUpdate } from '@aniforge/shared';
import { ApiError } from './errors.js';
import { imageStoragePath, projectStoragePrefix, type AssetStorage } from './assets/storage.js';
import type { NormalizedImage } from './assets/images.js';

export interface ProjectListOptions { cursor?: string; limit: number }
export interface ProjectRepository {
  list(ownerId: string, options: ProjectListOptions): Promise<ProjectPage>;
  get(id: string): Promise<Project | null>;
  create(ownerId: string, title: string, description: string): Promise<Project>;
  update(id: string, ownerId: string, changes: ProjectUpdate): Promise<Project>;
  remove(id: string, ownerId: string): Promise<void>;
  duplicate(id: string, ownerId: string): Promise<Project>;
  scenes(id: string): Promise<Scene[]>;
  scene(id: string, sceneId: string): Promise<Scene | null>;
  updateScene(id: string, sceneId: string, ownerId: string, changes: SceneUpdate): Promise<Scene>;
  uploadAsset(id: string, sceneId: string, ownerId: string, image: NormalizedImage): Promise<Asset>;
  asset(id: string, assetId: string, ownerId: string): Promise<Asset>;
  assetContent(id: string, assetId: string, ownerId: string): Promise<Buffer>;
}

type AssetRecord = Asset & { storagePath: string; state: 'pending' | 'ready' | 'cleanup' };
const NOT_FOUND = () => new ApiError(404, 'NOT_FOUND', 'Project or asset not found.');
const MAX_COPY_ASSETS = 200;
const STALE_OPERATION_MS = 60 * 60 * 1000;

export function assertOwner(project: Project | null, ownerId: string): asserts project is Project {
  if (!project || project.ownerId !== ownerId) throw NOT_FOUND();
}
function publicProject(raw: DocumentData): Project {
  const { lifecycle: _lifecycle, deletedAt: _deletedAt, ...project } = raw;
  return projectSchema.parse(project);
}
function publicAsset(record: AssetRecord): Asset {
  const { storagePath: _storagePath, state: _state, ...asset } = record;
  return assetSchema.parse(asset);
}
function assetRecord(raw: DocumentData | undefined, ownerId: string, projectId: string, assetId: string): AssetRecord {
  if (!raw || raw.state !== 'ready' || raw.ownerId !== ownerId || raw.projectId !== projectId || raw.id !== assetId || raw.storagePath !== imageStoragePath(ownerId, projectId, assetId)) throw NOT_FOUND();
  return { ...publicAsset(raw as AssetRecord), storagePath: raw.storagePath as string, state: 'ready' };
}
function sourceAssets(scene: Scene) { return [...new Set(scene.canvas.objects.flatMap((object) => object.type === 'image' ? [object.assetId] : []))]; }

export class FirestoreProjectRepository implements ProjectRepository {
  constructor(private db: Firestore, private storage: AssetStorage | null = null) {}
  private ref(id: string) { return this.db.collection('projects').doc(id); }
  private media() {
    if (!this.storage) throw new ApiError(503, 'STORAGE_SETUP_REQUIRED', 'Configure GCS_BUCKET and private Cloud Storage access. See docs/cloud-setup.md.');
    return this.storage;
  }
  private async transactionOwner(transaction: Transaction, ref: DocumentReference, ownerId: string) {
    const snapshot = await transaction.get(ref);
    const raw = snapshot.data();
    if (!raw || raw.ownerId !== ownerId || (raw.lifecycle && raw.lifecycle !== 'active')) throw NOT_FOUND();
    return publicProject(raw);
  }
  async list(ownerId: string, { cursor, limit }: ProjectListOptions): Promise<ProjectPage> {
    let after: string | undefined;
    if (cursor) {
      try {
        const decoded: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        if (!decoded || typeof decoded !== 'object' || !('ownerId' in decoded) || decoded.ownerId !== ownerId || !('id' in decoded) || typeof decoded.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(decoded.id)) throw new Error('Invalid cursor');
        after = decoded.id;
      } catch { throw new ApiError(400, 'INVALID_CURSOR', 'Project page expired or is invalid. Refresh your projects.'); }
    }
    const items: Project[] = [];
    let lastId = after;
    while (items.length <= limit) {
      let query = this.db.collection('projects').where('ownerId', '==', ownerId).orderBy(FieldPath.documentId()).limit(limit + 1);
      if (lastId) query = query.startAfter(lastId);
      const snapshot = await query.get();
      if (snapshot.empty) break;
      for (const doc of snapshot.docs) {
        lastId = doc.id;
        const raw = doc.data();
        if (!raw.lifecycle || raw.lifecycle === 'active') items.push(publicProject(raw));
        if (items.length > limit) break;
      }
      if (items.length > limit || snapshot.size < limit + 1) break;
    }
    const hasMore = items.length > limit;
    if (hasMore) items.pop();
    return { items, nextCursor: hasMore ? Buffer.from(JSON.stringify({ ownerId, id: items.at(-1)!.id })).toString('base64url') : null };
  }
  async get(id: string) {
    const raw = (await this.ref(id).get()).data();
    return raw && (!raw.lifecycle || raw.lifecycle === 'active') ? publicProject(raw) : null;
  }
  async create(ownerId: string, title: string, description: string) {
    const id = randomUUID(); const sceneId = randomUUID(); const now = new Date().toISOString();
    const project = projectSchema.parse({ id, ownerId, title, description, aspectRatio: '16:9', sceneOrder: [sceneId], createdAt: now, updatedAt: now, schemaVersion: 1 });
    const batch = this.db.batch();
    batch.create(this.ref(id), { ...project, lifecycle: 'active' });
    batch.create(this.ref(id).collection('scenes').doc(sceneId), emptyScene(id, sceneId, now));
    await batch.commit(); return project;
  }
  async update(id: string, ownerId: string, changes: ProjectUpdate) {
    return this.db.runTransaction(async (transaction) => {
      const ref = this.ref(id); const project = await this.transactionOwner(transaction, ref, ownerId);
      const updated = projectSchema.parse({ ...project, ...changes, updatedAt: new Date().toISOString() });
      transaction.set(ref, { ...updated, lifecycle: 'active' }); return updated;
    });
  }
  async remove(id: string, ownerId: string) {
    // Retain a hidden tombstone: late writes from crashed uploaders must remain purgeable.
    await this.db.runTransaction(async (transaction) => {
      const ref = this.ref(id); const raw = (await transaction.get(ref)).data();
      if (!raw || raw.ownerId !== ownerId) throw NOT_FOUND();
      transaction.set(ref, { id, ownerId, lifecycle: 'deleting', deletedAt: raw.deletedAt ?? new Date().toISOString() });
    });
    await this.purgeProject(id, ownerId);
  }
  private async purgeProject(id: string, ownerId: string) {
    if (this.storage) await this.storage.removePrefix(projectStoragePrefix(ownerId, id));
    else if (!(await this.ref(id).collection('assets').limit(1).get()).empty) this.media();
    const collections = await this.ref(id).listCollections();
    for (const collection of collections) await this.db.recursiveDelete(collection);
  }
  async duplicate(id: string, ownerId: string) {
    const newId = randomUUID(); const now = new Date().toISOString();
    const reserved = await this.db.runTransaction(async (transaction) => {
      const original = await this.transactionOwner(transaction, this.ref(id), ownerId);
      const snapshot = await transaction.get(this.ref(id).collection('scenes'));
      if (snapshot.size > 100) throw new ApiError(409, 'PROJECT_LIMIT', 'This project exceeds the supported scene count.');
      const scenes = snapshot.docs.map((doc) => sceneSchema.parse(doc.data()));
      const ids = [...new Set(scenes.flatMap(sourceAssets))];
      if (ids.length > MAX_COPY_ASSETS || Buffer.byteLength(JSON.stringify(scenes)) > 8_000_000) throw new ApiError(409, 'PROJECT_LIMIT', 'This project is too large to duplicate in one operation.');
      const assets = ids.length ? (await transaction.getAll(...ids.map((assetId) => this.ref(id).collection('assets').doc(assetId)))).map((doc) => assetRecord(doc.data(), ownerId, id, doc.id)) : [];
      if (assets.length) this.media();
      const sceneIds = new Map<string, string>(scenes.map((scene) => [scene.id, randomUUID()]));
      const assetIds = new Map<string, string>(assets.map((asset) => [asset.id, randomUUID()]));
      const copies = scenes.map((scene) => sceneSchema.parse({ ...scene, id: sceneIds.get(scene.id), projectId: newId, revision: 0, canvas: { ...scene.canvas, objects: scene.canvas.objects.map((object) => object.type === 'image' ? { ...object, assetId: assetIds.get(object.assetId) } : object) }, sourceAssetIds: sourceAssets(scene).map((assetId) => assetIds.get(assetId)), selectedVideoVersionId: null, updatedAt: now }));
      const copiedAssets = assets.map((asset) => ({ ...asset, id: assetIds.get(asset.id)!, projectId: newId, sceneId: sceneIds.get(asset.sceneId)!, storagePath: imageStoragePath(ownerId, newId, assetIds.get(asset.id)!), createdAt: now }));
      for (const asset of copiedAssets) publicAsset(asset);
      const project = projectSchema.parse({ ...original, id: newId, title: `${original.title.slice(0, 113)} (copy)`, sceneOrder: original.sceneOrder.map((sceneId) => sceneIds.get(sceneId)).filter((sceneId): sceneId is string => !!sceneId), createdAt: now, updatedAt: now });
      transaction.create(this.ref(newId), { ...project, lifecycle: 'copying' });
      return { original, scenes, assets, copiedAssets, copies, project };
    });
    try {
      for (let index = 0; index < reserved.assets.length; index++) await this.media().copy(reserved.assets[index]!.storagePath, reserved.copiedAssets[index]!.storagePath);
      await this.db.runTransaction(async (transaction) => {
        const original = await this.transactionOwner(transaction, this.ref(id), ownerId);
        const target = (await transaction.get(this.ref(newId))).data();
        const latest = reserved.scenes.length ? await transaction.getAll(...reserved.scenes.map((scene) => this.ref(id).collection('scenes').doc(scene.id))) : [];
        if (!target || target.lifecycle !== 'copying' || original.updatedAt !== reserved.original.updatedAt || latest.some((doc, index) => !doc.exists || sceneSchema.parse(doc.data()).revision !== reserved.scenes[index]!.revision)) throw new ApiError(409, 'PROJECT_CHANGED', 'The project changed while being duplicated. Please retry.');
        transaction.set(this.ref(newId), { ...reserved.project, lifecycle: 'active' });
        for (const scene of reserved.copies) transaction.create(this.ref(newId).collection('scenes').doc(scene.id), scene);
        for (const asset of reserved.copiedAssets) transaction.create(this.ref(newId).collection('assets').doc(asset.id), asset);
      });
      return reserved.project;
    } catch (error) {
      if (await this.get(newId)) return reserved.project;
      try { await this.remove(newId, ownerId); } catch { /* Hidden tombstone is retried by cleanup. */ }
      throw error;
    }
  }
  async scenes(id: string) {
    const snapshot = await this.ref(id).collection('scenes').limit(100).get();
    return snapshot.docs.map((doc) => sceneSchema.parse(doc.data())).sort((a, b) => a.order - b.order);
  }
  async scene(id: string, sceneId: string) {
    const snapshot = await this.ref(id).collection('scenes').doc(sceneId).get();
    return snapshot.exists ? sceneSchema.parse(snapshot.data()) : null;
  }
  async updateScene(id: string, sceneId: string, ownerId: string, changes: SceneUpdate) {
    return this.db.runTransaction(async (transaction) => {
      const projectRef = this.ref(id); await this.transactionOwner(transaction, projectRef, ownerId);
      const ref = projectRef.collection('scenes').doc(sceneId); const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new ApiError(404, 'NOT_FOUND', 'Scene not found.');
      const current = sceneSchema.parse(snapshot.data()); const { expectedRevision, ...content } = changes;
      if (expectedRevision !== current.revision) throw new ApiError(409, 'SCENE_CONFLICT', 'This scene was saved elsewhere. Reload the saved scene before retrying.');
      const now = new Date().toISOString();
      const scene = sceneSchema.parse({ ...current, ...content, revision: current.revision + 1, updatedAt: now });
      scene.sourceAssetIds = sourceAssets(scene);
      if (scene.sourceAssetIds.length > 100) throw new ApiError(400, 'ASSET_LIMIT', 'A scene can reference at most 100 images.');
      const assets = scene.sourceAssetIds.length ? await transaction.getAll(...scene.sourceAssetIds.map((assetId) => projectRef.collection('assets').doc(assetId))) : [];
      const metadata = new Map(assets.map((doc) => [doc.id, assetRecord(doc.data(), ownerId, id, doc.id)]));
      for (const object of scene.canvas.objects) {
        if (object.type !== 'image' || !object.crop) continue;
        const asset = metadata.get(object.assetId)!;
        if (object.crop.x + object.crop.width > asset.width || object.crop.y + object.crop.height > asset.height) throw new ApiError(400, 'INVALID_CROP', 'The selected panel lies outside the source image.');
      }
      transaction.set(ref, scene); transaction.update(projectRef, { updatedAt: now }); return scene;
    });
  }
  async uploadAsset(id: string, sceneId: string, ownerId: string, image: NormalizedImage): Promise<Asset> {
    const storage = this.media(); const assetId = randomUUID(); const ref = this.ref(id).collection('assets').doc(assetId);
    const asset = assetSchema.parse({ id: assetId, ownerId, projectId: id, sceneId, mimeType: 'image/png', sizeBytes: image.bytes.length, width: image.width, height: image.height, copyrightAttested: true, createdAt: new Date().toISOString() });
    const storagePath = imageStoragePath(ownerId, id, assetId);
    await this.db.runTransaction(async (transaction) => {
      await this.transactionOwner(transaction, this.ref(id), ownerId);
      if (!(await transaction.get(this.ref(id).collection('scenes').doc(sceneId))).exists) throw new ApiError(404, 'NOT_FOUND', 'Scene not found.');
      transaction.create(ref, { ...asset, storagePath, state: 'pending' });
    });
    try {
      await storage.put(storagePath, image.bytes);
      await this.db.runTransaction(async (transaction) => {
        await this.transactionOwner(transaction, this.ref(id), ownerId);
        const pending = (await transaction.get(ref)).data();
        if (!pending || pending.state !== 'pending') throw NOT_FOUND();
        transaction.update(ref, { state: 'ready' });
      });
      return asset;
    } catch (error) {
      if ((await ref.get()).data()?.state === 'ready' && await this.get(id)) return asset;
      try { await this.cleanupAsset(ref, ownerId, id, assetId); } catch { /* Reservation survives for retry. */ }
      throw error;
    }
  }
  private async readAssetRecord(id: string, assetId: string, ownerId: string) {
    return this.db.runTransaction(async (transaction) => {
      await this.transactionOwner(transaction, this.ref(id), ownerId);
      return assetRecord((await transaction.get(this.ref(id).collection('assets').doc(assetId))).data(), ownerId, id, assetId);
    });
  }
  async asset(id: string, assetId: string, ownerId: string) { return publicAsset(await this.readAssetRecord(id, assetId, ownerId)); }
  async assetContent(id: string, assetId: string, ownerId: string) {
    const asset = await this.readAssetRecord(id, assetId, ownerId); return this.media().read(asset.storagePath);
  }
  private async cleanupAsset(ref: DocumentReference, ownerId: string, projectId: string, assetId: string) {
    const shouldRemove = await this.db.runTransaction(async (transaction) => {
      const raw = (await transaction.get(ref)).data();
      if (raw?.state === 'ready') return false;
      if (raw) transaction.update(ref, { state: 'cleanup' });
      return true;
    });
    if (shouldRemove) { await this.media().remove(imageStoragePath(ownerId, projectId, assetId)); await ref.delete(); }
  }
  /** Startup and periodic retry of interrupted operations; private tombstones remain durable. */
  async retryPendingCleanup(now = Date.now()) {
    let failures = 0; let projectsRetried = 0; let assetsRetried = 0;
    const projects = await this.db.collection('projects').where('lifecycle', 'in', ['deleting', 'copying']).get();
    for (const doc of projects.docs) {
      const raw = doc.data();
      if (raw.lifecycle === 'copying' && Date.parse(String(raw.createdAt)) > now - STALE_OPERATION_MS) continue;
      try { await this.remove(doc.id, String(raw.ownerId)); projectsRetried++; } catch { failures++; }
    }
    const assets = await this.db.collectionGroup('assets').where('state', 'in', ['pending', 'cleanup']).get();
    for (const doc of assets.docs) {
      const raw = doc.data();
      if (raw.state === 'pending' && Date.parse(String(raw.createdAt)) > now - STALE_OPERATION_MS) continue;
      try { await this.cleanupAsset(doc.ref, String(raw.ownerId), String(raw.projectId), doc.id); assetsRetried++; } catch { failures++; }
    }
    if (failures) throw new Error(`Private asset cleanup has ${failures} pending operation(s). Verify storage permissions and retry.`);
    return { projectsRetried, assetsRetried };
  }
}
