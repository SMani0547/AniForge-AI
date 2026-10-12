import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

const image = process.argv[2] ?? 'aniforge-api:check';
const docker = (args) => execFileSync('docker', args, { encoding: 'utf8', timeout: 30_000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
async function check(kind) {
  const name = `aniforge-${kind}-check-${randomUUID().slice(0, 8)}`;
  let started = false;
  try {
    const env = ['NODE_ENV=production', 'PORT=8080', 'GOOGLE_CLOUD_PROJECT=demo-aniforge-container-check', 'ENABLE_REAL_AI=false', `ENABLE_VIDEO_GENERATION=${kind === 'worker'}`, 'METADATA_SERVER_DETECTION=none', 'ALLOWED_ORIGINS=https://aniforge.invalid'];
    if (kind === 'worker') env.push('GCS_BUCKET=demo-aniforge-container-check', 'CLOUD_TASKS_QUEUE=container-check', 'CLOUD_TASKS_LOCATION=us-central1', 'WORKER_URL=https://aniforge-check.run.app', 'TASKS_SERVICE_ACCOUNT=tasks@demo-aniforge-container-check.iam.gserviceaccount.com');
    docker(['run', '--detach', '--rm', '--network', 'none', '--name', name, ...env.flatMap((value) => ['--env', value]), image, 'node', `apps/api/dist/${kind === 'worker' ? 'worker' : 'server'}.js`]); started = true;
    const expression = kind === 'worker'
      ? "const r=await fetch('http://127.0.0.1:8080/internal/jobs/execute',{method:'POST',signal:AbortSignal.timeout(2000)});if(r.status!==401)throw Error('Expected401');"
      : "const r=await fetch('http://127.0.0.1:8080/health',{signal:AbortSignal.timeout(2000)});if(r.status!==200||(await r.json()).data.status!=='ok')throw Error('Expectedhealth');const p=await fetch('http://127.0.0.1:8080/api/v1/projects',{signal:AbortSignal.timeout(2000)});if(p.status!==401)throw Error('Expected401');";
    let ready = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      try { docker(['exec', name, 'node', '--input-type=module', '-e', `if(process.getuid()===0)throw Error('Must run as nonroot');${expression}`]); ready = true; break; }
      catch { await setTimeout(500); }
    }
    if (!ready) throw new Error(`${kind} container failed startup/authentication/nonroot smoke checks.`);
    console.info(`${kind} container smoke passed with no external network or cloud credentials.`);
  } finally { if (started) docker(['stop', '--time', '2', name]); }
}
try { docker(['version', '--format', '{{.Server.Version}}']); await check('api'); await check('worker'); }
catch (error) { console.error(error?.code === 'ENOENT' ? 'BLOCKED: Docker is not installed. No container test ran.' : 'Container smoke failed. Verify Docker, the built image and runtime configuration. No cloud/Google success is implied.'); process.exitCode = 1; }
