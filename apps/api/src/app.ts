import Fastify, { type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { z, ZodError } from 'zod';
import { createProjectSchema, resourceIdSchema, updateProjectSchema, updateSceneSchema } from '@aniforge/shared';
import { ApiError } from './errors.js';
import { assertOwner, type ProjectRepository } from './repository.js';
import type { Config } from './config.js';

interface Dependencies { config: Config; repository: ProjectRepository | null; verifyToken: ((token: string) => Promise<string>) | null; logger?: boolean }
const projectParams = z.object({ projectId: resourceIdSchema });
const sceneParams = projectParams.extend({ sceneId: resourceIdSchema });

export function buildApp({ config, repository, verifyToken, logger = false }: Dependencies) {
  const app = Fastify({ logger: logger ? { redact: ['req.headers.authorization', 'req.headers.cookie'] } : false, bodyLimit: 700_000, requestTimeout: 30_000 });
  const identities = new WeakMap<FastifyRequest, string>();
  const data = <T>(request: FastifyRequest, value: T) => ({ data: value, error: null, requestId: request.id });
  const store = () => { if (!repository) throw new ApiError(503, 'SETUP_REQUIRED', 'Configure Firebase and application-default credentials. See docs/cloud-setup.md.'); return repository; };
  const uid = (request: FastifyRequest) => { const id = identities.get(request); if (!id) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.'); return id; };
  const owned = async (request: FastifyRequest, projectId: string) => { const project = await store().get(projectId); assertOwner(project, uid(request)); return project; };

  app.register(cors, { origin: config.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()), methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] });
  app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  app.setErrorHandler((error, request, reply) => {
    let status = 500; let code = 'INTERNAL_ERROR'; let message = 'The request could not be completed. Retry or check server configuration.';
    if (error instanceof ApiError) { status = error.statusCode; code = error.code; message = error.message; }
    else if (error instanceof ZodError) { status = 400; code = 'INVALID_REQUEST'; message = 'Request validation failed. Check field values and remove unsupported fields.'; }
    else if (error && typeof error === 'object' && 'statusCode' in error) {
      const candidate = Number(error.statusCode);
      if (candidate >= 400 && candidate < 500) { status = candidate; code = candidate === 429 ? 'RATE_LIMITED' : 'INVALID_REQUEST'; message = candidate === 429 ? 'Too many requests. Wait a minute and retry.' : 'Invalid request body or content type.'; }
    }
    if (status >= 500) request.log.error({ code, requestId: request.id }, 'Request failed; inspect configuration.');
    reply.status(status).send({ data: null, error: { code, message }, requestId: request.id });
  });
  app.setNotFoundHandler((request, reply) => reply.code(404).send({ data: null, error: { code: 'NOT_FOUND', message: 'Route not found.' }, requestId: request.id }));
  app.get('/health', async (request) => data(request, { status: 'ok', service: 'aniforge-api', firebaseConfigured: !!repository, milestone: 'foundation' }));
  app.get('/api/v1/health', async (request) => data(request, { status: 'ok', firebaseConfigured: !!repository }));

  app.register(async (api) => {
    api.addHook('preHandler', async (request) => {
      const header = request.headers.authorization;
      if (!header?.startsWith('Bearer ') || header.length <= 7) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
      if (!verifyToken) throw new ApiError(503, 'SETUP_REQUIRED', 'Firebase is not configured. See docs/cloud-setup.md.');
      try { identities.set(request, await verifyToken(header.slice(7))); }
      catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
        if (['app/invalid-credential', 'app/network-error', 'auth/insufficient-permission', 'auth/internal-error'].includes(code)) throw new ApiError(503, 'AUTH_UNAVAILABLE', 'Authentication is temporarily unavailable. Check server credentials and Firebase Auth permissions.');
        throw new ApiError(401, 'UNAUTHENTICATED', 'Your session could not be verified. Sign in again.');
      }
    });
    api.get('/projects', async (request) => data(request, await store().list(uid(request))));
    api.post('/projects', async (request, reply) => {
      const input = createProjectSchema.parse(request.body);
      const project = await store().create(uid(request), input.title, input.description ?? '');
      return reply.code(201).send(data(request, project));
    });
    api.get('/projects/:projectId', async (request) => data(request, await owned(request, projectParams.parse(request.params).projectId)));
    api.patch('/projects/:projectId', async (request) => {
      const { projectId } = projectParams.parse(request.params); await owned(request, projectId);
      return data(request, await store().update(projectId, uid(request), updateProjectSchema.parse(request.body)));
    });
    api.delete('/projects/:projectId', async (request) => {
      const { projectId } = projectParams.parse(request.params); await owned(request, projectId);
      await store().remove(projectId, uid(request)); return data(request, null);
    });
    api.post('/projects/:projectId/duplicate', async (request, reply) => {
      const { projectId } = projectParams.parse(request.params); await owned(request, projectId);
      return reply.code(201).send(data(request, await store().duplicate(projectId, uid(request))));
    });
    api.get('/projects/:projectId/scenes', async (request) => {
      const { projectId } = projectParams.parse(request.params); await owned(request, projectId);
      return data(request, await store().scenes(projectId));
    });
    api.get('/projects/:projectId/scenes/:sceneId', async (request) => {
      const { projectId, sceneId } = sceneParams.parse(request.params); await owned(request, projectId);
      const scene = await store().scene(projectId, sceneId);
      if (!scene) throw new ApiError(404, 'NOT_FOUND', 'Scene not found.');
      return data(request, scene);
    });
    api.patch('/projects/:projectId/scenes/:sceneId', async (request) => {
      const { projectId, sceneId } = sceneParams.parse(request.params); await owned(request, projectId);
      const changes = updateSceneSchema.parse(request.body);
      if (changes.canvas?.objects.some((object) => object.type === 'image')) throw new ApiError(409, 'ASSETS_UNAVAILABLE', 'Image imports require the upcoming private asset milestone.');
      return data(request, await store().updateScene(projectId, sceneId, uid(request), changes));
    });
  }, { prefix: '/api/v1' });
  return app;
}
