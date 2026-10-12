import { applicationDefault, deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readConfig } from './config.js';
import { readVideoConfig } from './video-config.js';
import { VideoLedger } from './video-ledger.js';
import { CloudVideoQueue } from './video-queue.js';

const config = readConfig(); const queue = new CloudVideoQueue(readVideoConfig());
const firebase = initializeApp({ projectId: config.GOOGLE_CLOUD_PROJECT, credential: applicationDefault() });
try { await new VideoLedger(getFirestore(firebase)).recover((key, recovery) => queue.enqueue(key, recovery)); console.info('Video outbox recovery completed.'); }
catch { console.error('Video outbox recovery failed. Check Firestore indexes, Cloud Tasks and service account permissions.'); process.exitCode = 1; }
finally { await deleteApp(firebase); }
