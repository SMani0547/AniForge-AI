import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  GOOGLE_CLOUD_PROJECT: z.string().trim().default(''),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
});
export type Config = z.infer<typeof schema>;
export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) throw new Error(`Invalid server configuration: ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`);
  const config = parsed.data;
  if (config.NODE_ENV === 'production' && !config.GOOGLE_CLOUD_PROJECT) throw new Error('GOOGLE_CLOUD_PROJECT is required in production.');
  if (config.NODE_ENV === 'production' && (env.FIREBASE_AUTH_EMULATOR_HOST || env.FIRESTORE_EMULATOR_HOST)) throw new Error('Firebase emulators must not be enabled in production.');
  if (config.ALLOWED_ORIGINS.split(',').some((origin) => { try { const url = new URL(origin.trim()); return !['http:', 'https:'].includes(url.protocol) || url.origin !== origin.trim(); } catch { return true; } })) throw new Error('ALLOWED_ORIGINS must contain exact comma-separated HTTP(S) origins.');
  return config;
}
