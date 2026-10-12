import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { buildApp } from './app.js';
import { readConfig } from './config.js';
import { FirestoreProjectRepository } from './repository.js';
import { CloudAssetStorage } from './assets/storage.js';
import { SceneAnalysisService } from './analysis.js';
import { FirestoreAnalysisLedger } from './analysis-ledger.js';
import { readAnalysisConfiguration } from './ai/config.js';
import { createGoogleAnalysisProvider } from './ai/google-transport.js';
import { VideoLedger } from './video-ledger.js';
import { VideoService } from './video.js';
import { CloudVideoQueue } from './video-queue.js';
import { readVideoConfig } from './video-config.js';

const config = readConfig();
const firebase = config.GOOGLE_CLOUD_PROJECT ? initializeApp({ projectId: config.GOOGLE_CLOUD_PROJECT, ...(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST ? {} : { credential: applicationDefault() }) }) : null;
const storage = firebase && config.GCS_BUCKET ? new CloudAssetStorage(getStorage(firebase), config.GCS_BUCKET) : null;
const repository = firebase ? new FirestoreProjectRepository(getFirestore(firebase), storage) : null;
const analysis = firebase && repository && storage ? new SceneAnalysisService(repository, new FirestoreAnalysisLedger(getFirestore(firebase)), () => {
  // Lazy configuration keeps the canvas usable with AI disabled. No runtime mock switch exists.
  const ai = readAnalysisConfiguration(process.env);
  return { model: ai.analysisModel, provider: createGoogleAnalysisProvider(ai) };
}, config.MAX_ANALYSES_PER_USER_PER_DAY) : null;
const video = firebase && storage ? new VideoService(new VideoLedger(getFirestore(firebase)), () => new CloudVideoQueue(readVideoConfig()), storage, config.MAX_VIDEOS_PER_USER_PER_DAY) : null;
const app = buildApp({ config, repository, analysis, video, verifyToken: firebase ? async (token) => (await getAuth(firebase).verifyIdToken(token, true)).uid : null, logger: true });
let cleanupRunning = false;
const cleanup = async () => {
  if (!repository || cleanupRunning) return;
  cleanupRunning = true;
  try { await repository.retryPendingCleanup(); }
  catch { app.log.warn('Private media cleanup will retry; verify Firestore indexes and Storage permissions.'); }
  finally { cleanupRunning = false; }
};
void cleanup();
const cleanupTimer = setInterval(() => { void cleanup(); }, 5 * 60 * 1000);
cleanupTimer.unref();
app.addHook('onClose', async () => { clearInterval(cleanupTimer); });
const listenHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ? '127.0.0.1' : '0.0.0.0';
try { await app.listen({ port: config.PORT, host: listenHost }); }
catch { app.log.error('API failed to start. Check PORT and Firebase configuration.'); process.exitCode = 1; }
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void app.close(); });
