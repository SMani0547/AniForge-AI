import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { readConfig } from './config.js';
import { readVideoConfig } from './video-config.js';
import { readAiConfiguration } from './ai/config.js';
import { createGoogleAiProvider } from './ai/google-transport.js';
import { CloudAssetStorage } from './assets/storage.js';
import { FirestoreProjectRepository } from './repository.js';
import { VideoLedger } from './video-ledger.js';
import { VideoWorker } from './video.js';
import { buildWorkerApp, taskVerifier } from './worker-app.js';

const config = readConfig(); const video = readVideoConfig();
if (!config.GCS_BUCKET) throw new Error('GCS_BUCKET is required for the private worker.');
const firebase = initializeApp({ projectId: config.GOOGLE_CLOUD_PROJECT, credential: applicationDefault() });
const storage = new CloudAssetStorage(getStorage(firebase), config.GCS_BUCKET);
const ledger = new VideoLedger(getFirestore(firebase));
const worker = new VideoWorker(ledger, new FirestoreProjectRepository(getFirestore(firebase), storage), storage, () => {
  const ai = readAiConfiguration(process.env);
  return createGoogleAiProvider({ ...ai, timeoutMs: Math.min(ai.timeoutMs, 300_000) });
});
const app = buildWorkerApp(worker, taskVerifier(video.WORKER_URL, video.TASKS_SERVICE_ACCOUNT));
await app.listen({ port: config.PORT, host: '0.0.0.0' });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void app.close(); });
