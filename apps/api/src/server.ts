import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { buildApp } from './app.js';
import { readConfig } from './config.js';
import { FirestoreProjectRepository } from './repository.js';

const config = readConfig();
const firebase = config.GOOGLE_CLOUD_PROJECT ? initializeApp({ projectId: config.GOOGLE_CLOUD_PROJECT, ...(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST ? {} : { credential: applicationDefault() }) }) : null;
const app = buildApp({ config, repository: firebase ? new FirestoreProjectRepository(getFirestore(firebase)) : null, verifyToken: firebase ? async (token) => (await getAuth(firebase).verifyIdToken(token, true)).uid : null, logger: true });
try { await app.listen({ port: config.PORT, host: '0.0.0.0' }); }
catch { app.log.error('API failed to start. Check PORT and Firebase configuration.'); process.exitCode = 1; }
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void app.close(); });
