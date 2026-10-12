# AniForge AI

An original-art anime studio built with React, Konva, Fastify, Firebase and server-side Google AI. The foundation milestone is implemented; this repository is **not yet an end-to-end deployed animation studio**.

## Current functionality

- Responsive dark project gallery, Firebase Google sign-in, optional anonymous sign-in, and owner-only project CRUD/duplication backed by Firestore when configured.
- Canonical editable scene JSON and secure scene read/update endpoints. The current browser sketch playground is explicitly **unsaved**; persistence, imports and the full editor are the next milestone.
- Real server-only Gemini scene analysis, Omni image-to-video and conversational-edit smoke commands. They require explicit paid opt-in, a server key and original-content affirmation. No fake/live fallback exists.
- Cloud deployment configuration, private database/storage rules, CI and scoped credential documentation.

No real Google AI call, cloud persistence verification, Docker build or deployment has been completed in this environment. No MP4 has been generated. The app's generation button remains disabled until the queued generation milestone.

## Local start

Install Node.js 24 LTS and npm 11. From this repository root:

```powershell
npm ci
npm run dev
```

The frontend opens at `http://127.0.0.1:5173`; API health is `http://localhost:8080/health`. Without credentials, the sketch playground works and setup requirements are visible. Cloud project operations return explicit configuration/authentication errors.

To enable Firebase persistence:

```powershell
Copy-Item apps/web/.env.example apps/web/.env.local
Copy-Item apps/api/.env.example apps/api/.env
```

Fill in public Firebase web configuration on the frontend and `GOOGLE_CLOUD_PROJECT` on the API. Enable Google sign-in, create Firestore, and authenticate local application-default credentials as described in [cloud setup](docs/cloud-setup.md). The server loads `apps/api/.env` automatically. Restart development servers after configuration changes. Set `VITE_ENABLE_ANONYMOUS_AUTH=true` only if anonymous Auth is enabled in the Firebase console.

Server secrets belong in ignored API environment files or Secret Manager. Never put a Gemini key or service-account credential in `VITE_*`, browser code or Git. There is no need to send secrets in chat.

## Real model smoke tests

Set server `GEMINI_API_KEY` and `ENABLE_REAL_AI=true` only after confirming billing and entitlement. Defaults are `gemini-3.8-flash` for analysis and `gemini-omni-1.1-flash` for video. Model interface verification and exact follow-up edit commands are in [the smoke-test guide](docs/model-verification.md).

```powershell
npm run build
npm run smoke:analysis -- --image 'C:\Art\original.png' --attest-original
npm run smoke:video -- --image 'C:\Art\original.png' --attest-original --prompt 'Create a 6-second original 2D anime shot. Preserve the subject and framing; animate a gentle breeze.'
```

Use absolute image paths. Each successful run saves its validated output and metadata into a new ignored `apps/api/artifacts/ai-smoke/` directory. Edits create separate files and retain the parent interaction ID. Manually play any resulting MP4: container validation alone does not prove correct playback or requested motion. All failed/disabled commands exit nonzero and do not claim success.

## Checks

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
npm audit
```

Unit tests use explicitly isolated auth/repository/provider doubles. The unconfigured browser smoke tests cover actual rendering, drawing, undo/redo and mobile fit; they do not prove Firebase persistence. See [actual Phase 1 results](docs/phase-1-results.md) for executed commands, counts and limitations.

## Repository and milestones

- `apps/web`: React/Vite/Tailwind/Konva studio and Firebase Auth.
- `apps/api`: Fastify, Firebase Admin repository and Google AI adapters/CLI.
- `packages/shared`: strict Zod API, project, scene, canvas and shot-plan schemas.
- `tests/e2e`: Chromium foundation smoke tests.

[TODO.md](TODO.md) tracks each acceptance gate and blocker. Read [BUILD_PLAN.md](BUILD_PLAN.md), [architecture](docs/architecture.md), [API reference](docs/api.md), and [cloud setup](docs/cloud-setup.md) before adding the next milestone.

Next: saved editable canvas and private image import/cropping; then integrated Gemini analysis, Cloud Tasks video jobs, immutable revisions, timeline/download and deployment. Generated MP4s are flat clips. Editable source, shot plans, captions and version history are separate data.
