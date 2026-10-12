import Fastify from 'fastify';
import { z } from 'zod';
import { resourceIdSchema } from '@aniforge/shared';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { ApiError } from './errors.js';
import type { VideoWorker } from './video.js';

export function trustedTaskIdentity(payload: TokenPayload | undefined, audience: string, email: string): boolean {
  return !!payload && ['https://accounts.google.com', 'accounts.google.com'].includes(payload.iss) && payload.aud === audience && payload.email === email && payload.email_verified === true;
}
export function taskVerifier(audience: string, email: string) {
  const client = new OAuth2Client();
  return async (token: string) => trustedTaskIdentity((await client.verifyIdToken({ idToken: token, audience })).getPayload(), audience, email);
}
export function buildWorkerApp(worker: Pick<VideoWorker, 'execute'>, verify: (token: string) => Promise<boolean>) {
  const app = Fastify({ bodyLimit: 2048, requestTimeout: 30_000 });
  app.setErrorHandler((error, _request, reply) => {
    const status = error instanceof ApiError ? error.statusCode : error instanceof z.ZodError ? 400 : 503;
    reply.code(status).send({ error: status === 401 ? 'Trusted task identity required.' : 'Worker request failed; safe retries are controlled by the job ledger.' });
  });
  app.post('/internal/jobs/execute', { onRequest: async (request) => {
    const authorization = request.headers.authorization;
    let accepted = false;
    if (authorization?.startsWith('Bearer ')) { try { accepted = await verify(authorization.slice(7)); } catch { /* No raw token errors in responses. */ } }
    if (!accepted) throw new ApiError(401, 'UNAUTHENTICATED', 'Trusted task identity required.');
  } }, async (request, reply) => {
    const key = z.strictObject({ projectId: resourceIdSchema, jobId: z.uuid() }).parse(request.body);
    try { await worker.execute(key); }
    catch (error) { if (!(error instanceof ApiError && error.statusCode === 404)) throw error; }
    return reply.code(204).send();
  });
  return app;
}
