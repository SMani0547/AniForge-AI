import { z } from 'zod';
import { ApiError } from './errors.js';

const cloudName = z.string().regex(/^[a-zA-Z0-9_-]+$/);
const schema = z.object({
  ENABLE_VIDEO_GENERATION: z.literal('true'),
  GOOGLE_CLOUD_PROJECT: cloudName,
  CLOUD_TASKS_LOCATION: cloudName,
  CLOUD_TASKS_QUEUE: cloudName,
  WORKER_URL: z.url().refine((value) => { const url = new URL(value); return url.protocol === 'https:' && url.origin === value && url.hostname.endsWith('.run.app'); }),
  TASKS_SERVICE_ACCOUNT: z.email().refine((value) => value.endsWith('.iam.gserviceaccount.com')),
});
export type VideoConfig = z.infer<typeof schema>;
export function readVideoConfig(env: NodeJS.ProcessEnv = process.env): VideoConfig {
  const result = schema.safeParse(env);
  if (!result.success) throw new ApiError(503, 'VIDEO_SETUP_REQUIRED', 'Configure ENABLE_VIDEO_GENERATION, project, queue, private WORKER_URL origin and task service account. See docs/cloud-setup.md.');
  return result.data;
}
