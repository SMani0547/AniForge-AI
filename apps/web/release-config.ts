const publicNames = new Set(['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID', 'VITE_API_BASE_URL', 'VITE_ENABLE_ANONYMOUS_AUTH', 'VITE_FIREBASE_AUTH_EMULATOR_URL']);

/** Release-only validation: ordinary development builds may remain unconfigured. Never log values. */
export function assertReleaseConfig(env: Record<string, string | undefined>, targetProject?: string): void {
  const problems: string[] = [];
  const required = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID', 'VITE_API_BASE_URL'];
  for (const name of required) if (!env[name]?.trim() || /replace|your[_-]|example|placeholder/i.test(env[name]!)) problems.push(`${name} is missing or still a placeholder`);
  for (const name of Object.keys(env)) if (name.startsWith('VITE_') && !publicNames.has(name)) problems.push('An unapproved VITE_ variable is present; only documented public settings may be bundled');
  const project = env.VITE_FIREBASE_PROJECT_ID?.trim() ?? '';
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project) || project.startsWith('demo-')) problems.push('VITE_FIREBASE_PROJECT_ID must identify the real Firebase project');
  if (targetProject && targetProject !== project) problems.push('Firebase deployment project does not match VITE_FIREBASE_PROJECT_ID');
  if (env.VITE_FIREBASE_AUTH_DOMAIN !== `${project}.firebaseapp.com`) problems.push('VITE_FIREBASE_AUTH_DOMAIN must use the project Firebase auth domain; custom auth domains need a separately reviewed configuration');
  if (!/^AIza[\w-]{35}$/.test(env.VITE_FIREBASE_API_KEY ?? '')) problems.push('VITE_FIREBASE_API_KEY must be the public Firebase Web app key');
  if (!/^1:\d+:web:[a-zA-Z0-9]+$/.test(env.VITE_FIREBASE_APP_ID ?? '')) problems.push('VITE_FIREBASE_APP_ID must be the Firebase Web app ID');
  if (env.VITE_FIREBASE_AUTH_EMULATOR_URL?.trim()) problems.push('Auth emulator configuration cannot be released');
  if (env.VITE_ENABLE_ANONYMOUS_AUTH && !['true', 'false'].includes(env.VITE_ENABLE_ANONYMOUS_AUTH)) problems.push('VITE_ENABLE_ANONYMOUS_AUTH must be true or false');
  try {
    const url = new URL(env.VITE_API_BASE_URL ?? '');
    if (url.protocol !== 'https:' || !url.hostname.includes('.') || /^(localhost|127\.)/.test(url.hostname) || url.hostname.endsWith('.localhost') || url.username || url.password || url.search || url.hash || url.pathname !== '/api/v1') throw new Error();
  } catch { problems.push('VITE_API_BASE_URL must be the HTTPS API URL ending in /api/v1, without credentials, query or fragment'); }
  if (problems.length) throw new Error(`Release configuration blocked:\n- ${[...new Set(problems)].join('\n- ')}\nSee docs/release-checklist.md. No configuration values were printed.`);
}
