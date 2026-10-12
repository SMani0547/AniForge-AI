import { randomUUID } from 'node:crypto';
import type { Firestore, Transaction, DocumentReference } from 'firebase-admin/firestore';
import { emptyScene, projectSchema, sceneSchema, type Project, type ProjectUpdate, type Scene, type SceneUpdate } from '@aniforge/shared';
import { ApiError } from './errors.js';

export interface ProjectRepository {
  list(ownerId: string): Promise<Project[]>;
  get(id: string): Promise<Project | null>;
  create(ownerId: string, title: string, description: string): Promise<Project>;
  update(id: string, ownerId: string, changes: ProjectUpdate): Promise<Project>;
  remove(id: string, ownerId: string): Promise<void>;
  duplicate(id: string, ownerId: string): Promise<Project>;
  scenes(id: string): Promise<Scene[]>;
  scene(id: string, sceneId: string): Promise<Scene | null>;
  updateScene(id: string, sceneId: string, ownerId: string, changes: SceneUpdate): Promise<Scene>;
}

export function assertOwner(project: Project | null, ownerId: string): asserts project is Project {
  if (!project || project.ownerId !== ownerId) throw new ApiError(404, 'NOT_FOUND', 'Project not found.');
}

export class FirestoreProjectRepository implements ProjectRepository {
  constructor(private db: Firestore) {}
  private ref(id: string) { return this.db.collection('projects').doc(id); }
  private async transactionOwner(transaction: Transaction, ref: DocumentReference, ownerId: string) {
    const snapshot = await transaction.get(ref);
    const project = snapshot.exists ? projectSchema.parse(snapshot.data()) : null;
    assertOwner(project, ownerId);
    return project;
  }
  async list(ownerId: string) {
    const snapshot = await this.db.collection('projects').where('ownerId', '==', ownerId).limit(100).get();
    return snapshot.docs.map((doc) => projectSchema.parse(doc.data())).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async get(id: string) {
    const doc = await this.ref(id).get();
    return doc.exists ? projectSchema.parse(doc.data()) : null;
  }
  async create(ownerId: string, title: string, description: string) {
    const id = randomUUID();
    const sceneId = randomUUID();
    const now = new Date().toISOString();
    const project = projectSchema.parse({ id, ownerId, title, description, aspectRatio: '16:9', sceneOrder: [sceneId], createdAt: now, updatedAt: now, schemaVersion: 1 });
    const batch = this.db.batch();
    batch.create(this.ref(id), project);
    batch.create(this.ref(id).collection('scenes').doc(sceneId), emptyScene(id, sceneId, now));
    await batch.commit();
    return project;
  }
  async update(id: string, ownerId: string, changes: ProjectUpdate) {
    return this.db.runTransaction(async (transaction) => {
      const ref = this.ref(id);
      const project = await this.transactionOwner(transaction, ref, ownerId);
      const updated = projectSchema.parse({ ...project, ...changes, updatedAt: new Date().toISOString() });
      transaction.set(ref, updated);
      return updated;
    });
  }
  async remove(id: string, ownerId: string) {
    // Phase 1 supports editable documents only. Media deletion is added with asset storage.
    assertOwner(await this.get(id), ownerId);
    await this.db.recursiveDelete(this.ref(id));
  }
  async duplicate(id: string, ownerId: string) {
    return this.db.runTransaction(async (transaction) => {
      const original = await this.transactionOwner(transaction, this.ref(id), ownerId);
      const source = await transaction.get(this.ref(id).collection('scenes'));
      if (source.size > 100) throw new ApiError(409, 'PROJECT_LIMIT', 'This project exceeds the supported scene count.');
      const newId = randomUUID();
      const now = new Date().toISOString();
      const sceneIds = new Map<string, string>(source.docs.map((doc) => [doc.id, randomUUID()]));
      const copies = source.docs.map((doc) => {
        const scene = sceneSchema.parse(doc.data());
        if (scene.sourceAssetIds.length || scene.canvas.objects.some((object) => object.type === 'image')) throw new ApiError(409, 'MEDIA_COPY_UNAVAILABLE', 'Media duplication requires the upcoming asset milestone.');
        return sceneSchema.parse({ ...scene, id: sceneIds.get(doc.id), projectId: newId, selectedVideoVersionId: null, updatedAt: now });
      });
      const project = projectSchema.parse({ ...original, id: newId, title: `${original.title.slice(0, 113)} (copy)`, sceneOrder: original.sceneOrder.map((sceneId) => sceneIds.get(sceneId)).filter((sceneId): sceneId is string => !!sceneId), createdAt: now, updatedAt: now });
      transaction.create(this.ref(newId), project);
      for (const scene of copies) transaction.create(this.ref(newId).collection('scenes').doc(scene.id), scene);
      return project;
    });
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
      const projectRef = this.ref(id);
      await this.transactionOwner(transaction, projectRef, ownerId);
      const ref = projectRef.collection('scenes').doc(sceneId);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new ApiError(404, 'NOT_FOUND', 'Scene not found.');
      const now = new Date().toISOString();
      const scene = sceneSchema.parse({ ...snapshot.data(), ...changes, updatedAt: now });
      transaction.set(ref, scene);
      transaction.update(projectRef, { updatedAt: now });
      return scene;
    });
  }
}
