import type { Storage } from 'firebase-admin/storage';

export interface AssetStorage {
  put(path: string, bytes: Buffer, contentType?: 'image/png' | 'video/mp4'): Promise<void>;
  read(path: string): Promise<Buffer>;
  copy(source: string, destination: string): Promise<void>;
  remove(path: string): Promise<void>;
  removePrefix(prefix: string): Promise<void>;
}

export function projectStoragePrefix(ownerId: string, projectId: string) {
  // Firebase UIDs may contain characters that are not safe path components.
  return `users/${encodeURIComponent(ownerId)}/projects/${projectId}/`;
}
export function imageStoragePath(ownerId: string, projectId: string, assetId: string) {
  return `${projectStoragePrefix(ownerId, projectId)}originals/${assetId}.png`;
}

export class CloudAssetStorage implements AssetStorage {
  private bucket;
  constructor(storage: Storage, bucketName: string) { this.bucket = storage.bucket(bucketName); }
  async put(path: string, bytes: Buffer, contentType: 'image/png' | 'video/mp4' = 'image/png') {
    await this.bucket.file(path).save(bytes, {
      resumable: false,
      validation: 'crc32c',
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { contentType, cacheControl: 'private, no-store' },
    });
  }
  async read(path: string) { const [bytes] = await this.bucket.file(path).download(); return bytes; }
  async copy(source: string, destination: string) {
    await this.bucket.file(source).copy(this.bucket.file(destination), { preconditionOpts: { ifGenerationMatch: 0 } });
  }
  async remove(path: string) { await this.bucket.file(path).delete({ ignoreNotFound: true }); }
  async removePrefix(prefix: string) {
    // Callers supply only a server-generated owner/project prefix, always ending in '/'.
    await this.bucket.deleteFiles({ prefix, force: true });
  }
}
