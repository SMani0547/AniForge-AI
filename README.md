# AniForge AI

An original-art anime studio built with React, Konva, Fastify, Firebase and server-side Google AI. The foundation and saved-canvas milestones are implemented; this repository is **not yet an end-to-end deployed animation studio**.

## Current functionality

- Responsive dark project gallery, Firebase Google sign-in, optional anonymous sign-in, and owner-only project CRUD/duplication backed by Firestore when configured.
- Saved canonical scene JSON with autosave/manual save, revision conflicts, pencil/brush/eraser, shapes/text, selection/transforms, layers, inspector and undo/redo. Cloud projects use the saved editor; the separate no-sign-in playground remains explicitly **unsaved**.
- Private PNG/JPEG/WEBP imports through the authenticated API, original-content affirmation and manual panel cropping. Images are validated and normalized to PNG; media bytes stay outside Firestore. Project copies receive independent images.
- Real server-only Gemini scene analysis, Omni image-to-video and conversational-edit smoke commands. They require explicit paid opt-in, a server key and original-content affirmation. No fake/live fallback exists.
- Cloud deployment configuration, private database/storage rules, CI and scoped credential documentation.

No real Google AI call, production cloud persistence verification, Docker build or deployment has been completed in this environment. No MP4 has been generated. The app's generation button remains disabled until the queued generation milestone. Local Firebase emulators allow the saved editor to run without cloud credentials.

## Local start

Install Node.js 24 LTS, npm 11 and Java 21+ (for emulators). From this repository root:

```powershell
npm ci
npm run dev:emulators
```

The frontend is at `http://127.0.0.1:5173`; choose **Continue as a guest**, create a project, and open the saved editor. Firebase Auth, Firestore and Storage run locally in the isolated `demo-aniforge` project. Gemini is disabled, and the launcher ignores personal environment files and cloud credentials. The first run downloads official emulator binaries. See [local emulators](docs/local-emulators.md) for prerequisites, ports and data lifetime.

`npm run dev` starts the normal servers instead, using your configured environment. Without Firebase configuration, it provides only the explicitly unsaved playground and setup guidance. API health is `http://localhost:8080/health`.

To connect to cloud Firebase instead of local emulators:

```powershell
Copy-Item apps/web/.env.example apps/web/.env.local
Copy-Item apps/api/.env.example apps/api/.env
```

Fill in public Firebase web configuration on the frontend, and `GOOGLE_CLOUD_PROJECT` plus `GCS_BUCKET` on the API. Enable Google sign-in, create Firestore/private storage, and authenticate local application-default credentials as described in [cloud setup](docs/cloud-setup.md). The server loads `apps/api/.env` automatically. Restart development servers after configuration changes. Set `VITE_ENABLE_ANONYMOUS_AUTH=true` only if anonymous Auth is enabled in the Firebase console.

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
npm run test:emulators
npm audit --omit=dev
```

Unit tests use explicitly isolated auth/repository/provider doubles. The unconfigured browser smoke tests cover rendering, drawing, undo/redo and mobile fit. The separate emulator suite exercises real local Auth, Firestore, Storage and browser save/reload; it does not prove production IAM or cloud deployment. See [Phase 2 results](docs/phase-2-results.md) and [Phase 1 results](docs/phase-1-results.md) for executed commands, counts and limitations.

The pinned Firebase CLI is a development dependency and currently brings transitive npm advisories; the production dependency audit is separate. Do not run `npm audit fix --force` to downgrade the CLI or silently break its dependencies. The local emulators bind only to loopback.

## Repository and milestones

- `apps/web`: React/Vite/Tailwind/Konva studio and Firebase Auth.
- `apps/api`: Fastify, Firebase Admin repository and Google AI adapters/CLI.
- `packages/shared`: strict Zod API, project, scene, canvas and shot-plan schemas.
- `tests/e2e`: Chromium foundation smoke tests.

[TODO.md](TODO.md) tracks each acceptance gate and blocker. Read [BUILD_PLAN.md](BUILD_PLAN.md), [architecture](docs/architecture.md), [API reference](docs/api.md), and [cloud setup](docs/cloud-setup.md) before adding the next milestone.

Next: integrated Gemini analysis, Cloud Tasks video jobs, immutable revisions, timeline/download and deployment. Generated MP4s are flat clips. Editable source, shot plans, captions and version history are separate data.
