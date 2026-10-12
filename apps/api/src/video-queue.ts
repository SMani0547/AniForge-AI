import { GoogleAuth } from 'google-auth-library';
import { ApiError } from './errors.js';
import type { VideoConfig } from './video-config.js';
import type { JobKey } from './video-ledger.js';
import type { VideoQueue } from './video.js';

export function cloudTask(config: VideoConfig, key: JobKey, recovery = false, now = Date.now()) {
  const parent = `projects/${config.GOOGLE_CLOUD_PROJECT}/locations/${config.CLOUD_TASKS_LOCATION}/queues/${config.CLOUD_TASKS_QUEUE}`;
  return { parent, task: {
    name: `${parent}/tasks/${key.projectId}-${key.jobId}${recovery ? `-recovery-${Math.floor(now / 300_000)}` : ''}`,
    dispatchDeadline: '600s',
    httpRequest: { httpMethod: 'POST', url: `${config.WORKER_URL}/internal/jobs/execute`, headers: { 'Content-Type': 'application/json' }, body: Buffer.from(JSON.stringify(key)).toString('base64'), oidcToken: { serviceAccountEmail: config.TASKS_SERVICE_ACCOUNT, audience: config.WORKER_URL } },
  } };
}
export class CloudVideoQueue implements VideoQueue {
  private auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  constructor(private config: VideoConfig) {}
  async enqueue(key: JobKey, recovery = false) {
    const { parent, task } = cloudTask(this.config, key, recovery);
    const token = await this.auth.getAccessToken();
    if (!token) throw new ApiError(503, 'QUEUE_UNAVAILABLE', 'Cloud Tasks credentials are unavailable.');
    const response = await fetch(`https://cloudtasks.googleapis.com/v2/${parent}/tasks`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ task }), signal: AbortSignal.timeout(10_000), redirect: 'error' });
    await response.body?.cancel();
    if (!response.ok && response.status !== 409) throw new ApiError(503, 'QUEUE_UNAVAILABLE', 'Cloud Tasks could not accept the job. Check queue and service account permissions.');
  }
}
