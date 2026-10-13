# AniForge AI

An original-art anime studio built with React, Konva, Fastify, Firebase and server-side Google AI. The foundation, saved canvas, scene analysis, queued video generation and revision/timeline implementation are present; this repository is **not yet an end-to-end deployed animation studio**. Real Google model access remains unverified.

## Current functionality

- Standalone public homepage with original artwork, interactive local examples, FAQ and direct links to saved projects or the unsaved drawing playground. It loads without Firebase or the editor.
- Dedicated project dashboard with grid/list views, search/sort of loaded projects, private saved-source thumbnails, project action menus and dismissible onboarding. Creation opens the saved editor immediately. Firebase Google sign-in, optional anonymous sign-in and owner-only project CRUD/duplication use Firestore when configured.
- Saved canonical scene JSON with autosave/manual save, revision conflicts, pencil/brush/eraser, shapes/text, selection/transforms, layers, inspector and undo/redo. Cloud projects use the saved editor; the separate no-sign-in playground remains explicitly **unsaved**.
- Private PNG/JPEG/WEBP imports through the authenticated API, original-content affirmation and manual panel cropping. Images are validated and normalized to PNG; media bytes stay outside Firestore. Project copies receive independent images.
- Editable shot plans and prompt preview saved with the canvas. Configured real Gemini analysis receives a private canonical snapshot and returns a separate suggestion for explicit review/apply. Revision checks, durable request IDs, attempt limits and safe error states protect existing work. Manual plans work without AI credentials.
- Real server-only Gemini scene analysis, Omni image-to-video and conversational-edit smoke commands. They require explicit paid opt-in, a server key and original-content affirmation. No fake/live fallback exists.
- Queue-backed video jobs, per-user attempt limits, trusted OIDC worker, immutable private MP4 versions, status polling and a player. Durable checkpoints retry existing media downloads without regenerating. See [worker setup](docs/video-worker-setup.md).
- Conversational edits create new immutable clips with parent links and prompt history. Compare parent/revised playback, save or restore the selected version, and preserve existing media when an edit fails. Expired interaction history offers an explicit stored-video upload mode with separate paid consent; there is no automatic paid fallback.
- Saved trim/caption metadata affects the browser preview. Download the selected version's original MP4 and separate timeline JSON; trim and captions are **not rendered into the MP4**.
- Cloud deployment configuration, private database/storage rules, CI and scoped credential documentation.
- Release-only Firebase/API configuration validation, Hosting predeploy build, bounded browser-secret scan, compiled API smoke and CI container checks. Local preparation does not mean deployment has succeeded.

No real Google AI call, production cloud persistence verification, Docker build or deployment has been completed in this environment. No Google-generated MP4 has been produced. Generation and editing require a configured private worker, Cloud Tasks queue and explicit paid consent. Two labeled original geometric MP4s are used only in tests. Local Firebase emulators allow the saved editor to run without cloud credentials.

## Local start

Install Node.js 24 LTS, npm 11 and Java 21+ (for emulators). From this repository root:

```powershell
npm ci
npm run dev:emulators
```

The frontend is at `http://127.0.0.1:5173`; choose **Open studio**, then **Continue as a guest**, create a project, and open the saved editor. Firebase Auth, Firestore and Storage run locally in the isolated `demo-aniforge` project. Gemini is disabled, and the launcher ignores personal environment files and cloud credentials. Use **Create manual shot plan** to edit and save direction without an AI call. The first run downloads official emulator binaries. See [local emulators](docs/local-emulators.md) for prerequisites, ports and data lifetime.

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
npm run test:built-api
npx playwright install chromium
npm run test:e2e
npm run test:emulators
npm audit --omit=dev
```

Unit tests use explicitly isolated auth/repository/provider doubles. The unconfigured browser smoke tests cover rendering, drawing, undo/redo and mobile fit. The separate emulator suite exercises real local Auth, Firestore, Storage and browser save/reload; it does not prove production IAM or cloud deployment. See [Phase 2 results](docs/phase-2-results.md) and [Phase 1 results](docs/phase-1-results.md) for executed commands, counts and limitations.

Browser tests inject explicitly labeled providers into test-only API instances while using real local Firebase services. They check source PNG pixels, analysis review/save/reload, video queuing, independent parent/revised playback, saved selection/timeline, exact MP4 downloads and safe failures. These fixtures are not live Gemini evidence. See [Phase 5 results](docs/phase-5-results.md) for current checks and outstanding real-model/cloud gates.

The pinned Firebase CLI is a development dependency and currently brings transitive npm advisories; the production dependency audit is separate. Do not run `npm audit fix --force` to downgrade the CLI or silently break its dependencies. The local emulators bind only to loopback.

## Repository and milestones

- `apps/web`: React/Vite/Tailwind/Konva studio and Firebase Auth.
- `apps/api`: Fastify API/private worker, Firebase Admin repositories, queue recovery and Google AI adapters/CLI.
- `packages/shared`: strict Zod API, project, scene, canvas, shot-plan, job and version schemas.
- `tests/e2e`: Chromium foundation smoke tests.

[TODO.md](TODO.md) tracks each acceptance gate and blocker. Read [BUILD_PLAN.md](BUILD_PLAN.md), [architecture](docs/architecture.md), [API reference](docs/api.md), and [cloud setup](docs/cloud-setup.md) before adding the next milestone.

[UI_UPGRADE_TODO.md](UI_UPGRADE_TODO.md) tracks the homepage, dashboard and editor redesign. U1 provides a development-only [design lab](http://127.0.0.1:5173/design), U2 the public homepage and U3 the [project dashboard](http://127.0.0.1:5173/projects); run the local server first. U4 now provides the saved Source/Video workspace with switchable phone panels; U5 generation/timeline polish is next. See [actual results](docs/ui-upgrade-results.md), [dashboard behavior and setup](docs/dashboard.md), [visual system](docs/ui-design-system.md) and [workspace behavior](docs/editor-workspace.md) and [U4 screenshots](docs/ui-u4/README.md). The external Artcraft visual review remains pending because no browser connection was available.

Phase 6 local release preparation is recorded in [the results](docs/phase-6-results.md). Cloud setup and live verification remain deferred by the owner; the full release is not complete. Follow the [release checklist](docs/release-checklist.md), [three-minute demo script](docs/demo-script.md) and [eight-slide outline](docs/pitch-outline.md). A [labeled local screenshot](docs/demo/README.md) documents test-fixture behavior, not Google output. The final demo video and PDF deck still need genuine evidence.

Hosting uses `npm run build:release` through its predeploy hook. Configure ignored `.env.local` or `.env.release.local` with actual public Firebase settings and an HTTPS API URL before running it; an ordinary unconfigured build is for local checks. Docker build/smoke and the optional `cloudbuild.yaml` remote build still require the corresponding tools/account. Required credentials and cloud steps are in [cloud setup](docs/cloud-setup.md), [worker setup](docs/video-worker-setup.md) and [model verification](docs/model-verification.md). Generated MP4s are flat clips. Editable source, shot plans, captions and version history are separate data.
