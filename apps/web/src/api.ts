import { analysisAvailabilitySchema, analysisResultSchema, assetSchema, projectPageSchema, projectSchema, sceneSchema, type AnalyzeScene, type Canvas, type Project, type ShotPlan } from '@aniforge/shared';
import { z } from 'zod';

const envelopeSchema = z.object({
  data: z.unknown().optional(),
  error: z.object({ code: z.string(), message: z.string() }).passthrough().nullable(),
  requestId: z.string(),
});

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly requestId?: string, readonly code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export function createApiClient(getToken: () => Promise<string | null>, baseUrl = '/api/v1', fetcher: typeof fetch = fetch) {
  async function request<T>(path: string, schema: z.ZodType<T>, method = 'GET', body?: unknown, timeoutMs = 20_000): Promise<T> {
    const token = await getToken();
    if (!token) throw new ApiError('Sign in to access your projects.', 401);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(`${baseUrl.replace(/\/$/, '')}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': body instanceof Blob ? body.type : 'application/json' }) },
        ...(body === undefined ? {} : { body: body instanceof Blob ? body : JSON.stringify(body) }),
        signal: controller.signal,
      });
      let raw: unknown;
      try { raw = await response.json(); }
      catch { throw new ApiError('The API returned an unreadable response. Check that the backend is running.', response.status); }
      const parsed = envelopeSchema.safeParse(raw);
      if (!parsed.success) throw new ApiError('The API returned an invalid response. Please try again.', response.status);
      const envelope = parsed.data;
      if (!response.ok || envelope.error) {
        throw new ApiError(envelope.error?.message ?? 'The request failed. Please try again.', response.status, envelope.requestId, envelope.error?.code);
      }
      const data = schema.safeParse(envelope.data);
      if (!data.success) throw new ApiError('The API returned invalid data. Please try again.', 502, envelope.requestId);
      return data.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (controller.signal.aborted) throw new ApiError(timeoutMs > 20_000 ? 'Analysis timed out in the browser. Google may still have processed this request. Retry the same analysis to check its result; starting a new analysis may incur another charge.' : 'The request timed out. Reload your projects before retrying a change.', 408);
      throw new ApiError('Could not reach the API. Check your connection and the backend configuration.', 0);
    } finally { clearTimeout(timeout); }
  }
  const projectPath = (id: string) => `/projects/${encodeURIComponent(id)}`;
  const scenePath = (projectId: string, sceneId: string) => `${projectPath(projectId)}/scenes/${encodeURIComponent(sceneId)}`;
  const assetPath = (projectId: string, assetId: string) => `${projectPath(projectId)}/assets/${encodeURIComponent(assetId)}`;
  return {
    listProjects: (cursor?: string) => request(`/projects${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, projectPageSchema),
    getProject: (id: string) => request(projectPath(id), projectSchema),
    createProject: (title: string) => request('/projects', projectSchema, 'POST', { title, description: '' }),
    renameProject: (id: string, title: string) => request(projectPath(id), projectSchema, 'PATCH', { title }),
    duplicateProject: (id: string) => request(`${projectPath(id)}/duplicate`, projectSchema, 'POST', {}),
    deleteProject: (id: string) => request(projectPath(id), z.null(), 'DELETE'),
    listScenes: (projectId: string) => request(`${projectPath(projectId)}/scenes`, z.array(sceneSchema)),
    getScene: (projectId: string, sceneId: string) => request(scenePath(projectId, sceneId), sceneSchema),
    saveScene: (projectId: string, sceneId: string, expectedRevision: number, canvas: Canvas, shotPlan?: ShotPlan | null) => request(scenePath(projectId, sceneId), sceneSchema, 'PATCH', { expectedRevision, canvas, ...(shotPlan === undefined ? {} : { shotPlan }) }),
    analysisStatus: () => request('/ai/analysis-status', analysisAvailabilitySchema),
    analyzeScene: (projectId: string, sceneId: string, input: AnalyzeScene) => request(`${scenePath(projectId, sceneId)}/analyze`, analysisResultSchema, 'POST', input, 55_000),
    uploadAsset: (projectId: string, sceneId: string, file: File) => request(`${projectPath(projectId)}/assets?sceneId=${encodeURIComponent(sceneId)}&copyrightAttested=true`, assetSchema, 'POST', file),
    getAsset: (projectId: string, assetId: string) => request(assetPath(projectId, assetId), assetSchema),
    async getAssetContent(projectId: string, assetId: string): Promise<Blob> {
      const token = await getToken();
      if (!token) throw new ApiError('Sign in to access your images.', 401);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);
      try {
        const response = await fetcher(`${baseUrl.replace(/\/$/, '')}${assetPath(projectId, assetId)}/content`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        if (!response.ok) throw new ApiError('Could not load this private image. Check your connection and try again.', response.status);
        if (!response.headers.get('content-type')?.startsWith('image/')) throw new ApiError('The server returned invalid image data.', 502);
        return await response.blob();
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(controller.signal.aborted ? 'Image loading timed out. Try again.' : 'Could not reach the image service. Try again.', controller.signal.aborted ? 408 : 0);
      } finally { clearTimeout(timeout); }
    },
  };
}

export type ProjectApi = ReturnType<typeof createApiClient>;
export function newestFirst(projects: Project[]) {
  return [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiError && error.requestId) return `${error.message} Reference: ${error.requestId}`;
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
