import { projectSchema, type Project } from '@aniforge/shared';
import { z } from 'zod';

const envelopeSchema = z.object({
  data: z.unknown().optional(),
  error: z.object({ code: z.string(), message: z.string() }).passthrough().nullable(),
  requestId: z.string(),
});

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly requestId?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export function createApiClient(getToken: () => Promise<string | null>, baseUrl = '/api/v1', fetcher: typeof fetch = fetch) {
  async function request<T>(path: string, schema: z.ZodType<T>, method = 'GET', body?: unknown): Promise<T> {
    const token = await getToken();
    if (!token) throw new ApiError('Sign in to access your projects.', 401);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetcher(`${baseUrl.replace(/\/$/, '')}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
      let raw: unknown;
      try { raw = await response.json(); }
      catch { throw new ApiError('The API returned an unreadable response. Check that the backend is running.', response.status); }
      const parsed = envelopeSchema.safeParse(raw);
      if (!parsed.success) throw new ApiError('The API returned an invalid response. Please try again.', response.status);
      const envelope = parsed.data;
      if (!response.ok || envelope.error) {
        throw new ApiError(envelope.error?.message ?? 'The request failed. Please try again.', response.status, envelope.requestId);
      }
      const data = schema.safeParse(envelope.data);
      if (!data.success) throw new ApiError('The API returned invalid project data. Please try again.', 502, envelope.requestId);
      return data.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (controller.signal.aborted) throw new ApiError('The request timed out. Reload your projects before retrying a change.', 408);
      throw new ApiError('Could not reach the API. Check your connection and the backend configuration.', 0);
    } finally { clearTimeout(timeout); }
  }
  const projectPath = (id: string) => `/projects/${encodeURIComponent(id)}`;
  return {
    listProjects: () => request('/projects', z.array(projectSchema)),
    getProject: (id: string) => request(projectPath(id), projectSchema),
    createProject: (title: string) => request('/projects', projectSchema, 'POST', { title, description: '' }),
    renameProject: (id: string, title: string) => request(projectPath(id), projectSchema, 'PATCH', { title }),
    duplicateProject: (id: string) => request(`${projectPath(id)}/duplicate`, projectSchema, 'POST', {}),
    deleteProject: (id: string) => request(projectPath(id), z.null(), 'DELETE'),
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
