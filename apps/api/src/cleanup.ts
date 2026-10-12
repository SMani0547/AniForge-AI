import { applicationDefault, deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { readConfig } from './config.js';
import { FirestoreProjectRepository } from './repository.js';
import { CloudAssetStorage } from './assets/storage.js';

// Finite recovery entry point for an authenticated Cloud Run Job / operator.
// Unlike an in-process timer, a scheduled Job also runs while the API is idle.
const config = readConfig();
if (!config.GOOGLE_CLOUD_PROJECT || !config.GCS_BUCKET) throw new Error('Asset cleanup requires GOOGLE_CLOUD_PROJECT and GCS_BUCKET.');
const firebase = initializeApp({ projectId: config.GOOGLE_CLOUD_PROJECT, ...(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST ? {} : { credential: applicationDefault() }) });
try {
  const repository = new FirestoreProjectRepository(getFirestore(firebase), new CloudAssetStorage(getStorage(firebase), config.GCS_BUCKET));
  const result = await repository.retryPendingCleanup();
  console.info(JSON.stringify({ status: 'completed', ...result }));
} catch {
  console.error('Asset cleanup failed. Check private bucket access, Firestore indexes and application-default credentials, then retry. Durable cleanup records have been retained.');
  process.exitCode = 1;
} finally { await deleteApp(firebase); }
