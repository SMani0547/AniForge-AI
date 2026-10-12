import { describe, expect, it, vi } from 'vitest';
import { generateSceneSchema } from '@aniforge/shared';
import { trustedTaskIdentity, buildWorkerApp } from './worker-app.js';
import { readVideoConfig } from './video-config.js';
import { cloudTask } from './video-queue.js';
import { expiredJob, publicJob, WORKER_LEASE_MS, JOB_LIFETIME_MS, type JobRecord } from './video-ledger.js';
import type { TokenPayload } from 'google-auth-library';

const config = { ENABLE_VIDEO_GENERATION: 'true', GOOGLE_CLOUD_PROJECT: 'test-project', CLOUD_TASKS_LOCATION: 'us-central1', CLOUD_TASKS_QUEUE: 'aniforge-video', WORKER_URL: 'https://worker-example.run.app', TASKS_SERVICE_ACCOUNT: 'tasks@test-project.iam.gserviceaccount.com' } as const;
const jobId = '2e73e7ec-97bf-481c-819b-f1c509701e86';
const now = Date.parse('2026-10-12T12:00:00Z');
const job = { id: jobId, projectId: 'project', sceneId: 'scene', status: 'running', sourceRevision: 1, snapshotAssetId: 'snapshot', createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(), resultVersionId: null, errorCode: null, errorMessage: null, ownerId: 'alice', prompt: 'TEST FIXTURE', fingerprint: 'private', leaseToken: 'private', leaseUntil: now + WORKER_LEASE_MS, attempts: 1, dispatched: true, checkpoint: null } as JobRecord;

describe('queued video contracts and worker trust', () => {
  it('requires both paid and copyright affirmation and rejects arbitrary source URLs', () => {
    const input = { jobId, expectedRevision: 1, snapshotAssetId: 'snapshot', confirmPaid: true, copyrightAttested: true };
    expect(generateSceneSchema.safeParse(input).success).toBe(true);
    for (const changes of [{ confirmPaid: false }, { copyrightAttested: false }, { sourceUrl: 'https://attacker.invalid' }, { jobId: 'bad' }]) expect(generateSceneSchema.safeParse({ ...input, ...changes }).success).toBe(false);
  });
  it('fails closed on disabled video, non-HTTPS worker, path or foreign email', () => {
    expect(readVideoConfig(config)).toEqual(config);
    for (const changes of [{ ENABLE_VIDEO_GENERATION: 'false' }, { WORKER_URL: 'http://localhost:8080' }, { WORKER_URL: `${config.WORKER_URL}/internal/jobs/execute` }, { TASKS_SERVICE_ACCOUNT: 'user@example.com' }]) expect(() => readVideoConfig({ ...config, ...changes })).toThrow();
  });
  it('scopes named tasks, OIDC audience and payload without a provider secret', () => {
    const key = { projectId: 'project', jobId };
    const { task } = cloudTask(config, key);
    expect(task.httpRequest.oidcToken).toEqual({ audience: config.WORKER_URL, serviceAccountEmail: config.TASKS_SERVICE_ACCOUNT });
    expect(JSON.parse(Buffer.from(task.httpRequest.body, 'base64').toString())).toEqual(key);
    expect(task.dispatchDeadline).toBe('600s');
    expect(cloudTask(config, key).task.name).toBe(task.name);
    expect(cloudTask(config, key, true, now).task.name).not.toBe(task.name);
  });
  it('checks issuer, exact audience, email and verification after JWT verification', () => {
    const claims = { iss: 'https://accounts.google.com', aud: config.WORKER_URL, email: config.TASKS_SERVICE_ACCOUNT, email_verified: true } as TokenPayload;
    expect(trustedTaskIdentity(claims, config.WORKER_URL, config.TASKS_SERVICE_ACCOUNT)).toBe(true);
    for (const changes of [{ iss: 'https://evil.invalid' }, { aud: 'other-service' }, { email: 'attacker@example.com' }, { email_verified: false }]) expect(trustedTaskIdentity({ ...claims, ...changes }, config.WORKER_URL, config.TASKS_SERVICE_ACCOUNT)).toBe(false);
  });
  it('rejects spoofed task headers, a Firebase-style token and extra payload fields', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const app = buildWorkerApp({ execute }, async (token) => token === 'verified-task-test-fixture');
    try {
      for (const headers of [{ 'x-cloudtasks-taskname': 'spoofed' }, { authorization: 'Bearer firebase-user-fixture' }]) expect((await app.inject({ method: 'POST', url: '/internal/jobs/execute', headers, payload: { projectId: 'project', jobId } })).statusCode).toBe(401);
      expect(execute).not.toHaveBeenCalled();
      expect((await app.inject({ method: 'POST', url: '/internal/jobs/execute', headers: { authorization: 'Bearer verified-task-test-fixture' }, payload: { projectId: 'project', jobId, prompt: 'tampered' } })).statusCode).toBe(400);
      expect((await app.inject({ method: 'POST', url: '/internal/jobs/execute', headers: { authorization: 'Bearer verified-task-test-fixture' }, payload: { projectId: 'project', jobId } })).statusCode).toBe(204);
      expect(execute).toHaveBeenCalledOnce();
    } finally { await app.close(); }
  });
  it('never redispatches a paid request after its worker lease expires', () => {
    expect(expiredJob(job, now)).toBeNull();
    expect(expiredJob(job, now + WORKER_LEASE_MS)).toMatchObject({ status: 'failed', errorCode: 'GENERATION_OUTCOME_UNKNOWN' });
    expect(expiredJob({ ...job, checkpoint: { fileName: 'files/example', interactionId: 'server-only', model: 'test' } }, now + WORKER_LEASE_MS)).toBeNull();
    expect(expiredJob({ ...job, status: 'queued', dispatched: false }, now + JOB_LIFETIME_MS)).toMatchObject({ errorCode: 'JOB_EXPIRED' });
    expect(expiredJob({ ...job, status: 'succeeded' }, now + JOB_LIFETIME_MS)).toBeNull();
  });
  it('removes all private provider and worker metadata from browser job responses', () => {
    const result = publicJob(job);
    expect(result.id).toBe(jobId);
    for (const key of ['ownerId', 'checkpoint', 'fingerprint', 'leaseToken', 'prompt']) expect(result).not.toHaveProperty(key);
  });
});
