# Phase 5 — conversational revisions, timeline and download

Implemented October 13, 2026 (Pacific/Fiji). Application verification uses explicit test providers; real Google and deployed-cloud acceptance remain separate release gates.

## Delivered

- Authenticated edit jobs use an owned immutable parent, a saved prompt and the parent's private Google interaction ID. The worker checkpoints the new output before downloading it and publishes a separate MP4/version with a parent pointer. Editing never replaces the parent, canvas, timeline or selected version.
- Initial generations and edits share the per-user daily allowance, active-job restriction and durable dispatch/recovery rules. The edit fingerprint includes parent, prompt and mode. Same-ID retries reuse the captured request; failed or ambiguous edits never trigger another paid mode automatically.
- Explicit stored-MP4 editing uses Google's Files API and the existing server-only key. Size/digest checks and finite movie-header duration at most 10 seconds precede upload. The UI explains the duration and regional limitations before consent. Preview trim does not shorten the uploaded file. Temporary input cleanup and expiry are documented in [model verification](model-verification.md).
- Parent/revised players, prompt history, saved selection/revert and metadata lookup beyond the latest 30 versions. Existing media stays playable after failed edits. Interaction IDs, storage paths and digests remain private.
- Canvas, plan, selection and timeline edits share one revision-controlled save pipeline. Browser trim/captions use the original clip clock and decoded duration. Historical equal trim/caption endpoints and duplicate IDs remain readable without altering saved values; explicit corrections are required for new timeline writes.
- Authorized original MP4 export checks scene membership, size and digest. Download returns exact stored bytes, without rendering trim or captions. Separate timeline JSON retains editable settings. The UI states these limits.
- Dedicated test emulator ports preserve an already-running development session. Both profiles remain loopback-only, use `demo-aniforge`, exclude personal credentials and disable real AI. See [local emulator setup](local-emulators.md).

## Actual verification

| Command | Result |
| --- | --- |
| `npm run typecheck` | Passed for shared, API/scripts, web and test/tooling TypeScript |
| `npm run lint` | Passed |
| `npm run test` | 197 tests passed across 14 files |
| `npm run build` | Shared, API/worker and Vite production build passed |
| `npm run test:emulators` | 34 real Firebase emulator integration/browser tests passed; zero retries |
| `npm run test:e2e` | 2 desktop/mobile Chromium smoke tests passed |
| `npm audit --omit=dev` | 0 production vulnerabilities |
| Emulator script syntax and environment assertions | Passed: separate profiles, stripped inherited credentials and forced AI-off settings |

The revision browser test used real guest Auth, Fastify, Firestore, Storage and Chromium playback. The queue and provider were explicit fixtures. It verified initial queue persistence through reload, a separate edited version, independent parent/revised playback, saved selection and caption timing after reload, actual trim boundaries and caption display, a byte-identical MP4 download, restoration of the initial selection, and a failed edit preserving both existing clips. The screenshot in ignored `test-results/emulators` was inspected; rerun the suite to regenerate it. No browser page errors were reported.

The first unit command could not start because esbuild hit the Windows sandbox's ancestor-directory access restriction. The same command passed with approved execution outside that sandbox. The first emulator command stopped before running tests because an existing development session occupied the original ports. The launcher now uses a separate fixed test port profile and temporary Firebase hub directory; all 34 tests passed afterward. Port-owner verification confirmed that the original development processes were still listening and the test processes had stopped. No development data or processes were removed.

Nonfatal warnings remain: upstream Zod/Rollup annotation warnings, Firebase's Java 25 `Unsafe` warning, Playwright color-environment warnings and existing `PassThrough` MaxListeners warnings in emulator tests. The listener warning was not suppressed and remains undiagnosed. The prior Firebase CLI development-dependency advisories are unchanged; no dependencies were added in this phase. Production dependencies were audited separately above.

The two original geometric MP4s were recorded locally using Chromium and visibly say `TEST FIXTURE`. They differ in color and motion, so independent playback and byte comparisons detect accidental reuse of the parent. They are **not AI-generated output**. The new revised fixture was created with `node scripts/create-video-fixture.mjs --edited` (6,010 bytes).

Provider/HTTP tests intercept Google transport deliberately. Coverage includes `previous_interaction_id`, uploaded-video request formatting through the installed SDK, separate interaction IDs, stale prior-turn output rejection, output checkpoints, upload credential boundaries, invalid/overlong duration, deadlines and temporary-file cleanup. Application tests cover immutable lineage, private ownership, conflict handling, explicit upload fallback, missing retained history, quota accounting and deletion during an edit.

## Files changed

The implementation touches shared scene/job/version/input schemas; API routes, repository selection checks, video ledger/worker and Google provider/transport; web API, SceneSaver, CanvasEditor and GenerationPanel integration. New web files are `VideoVersionsPanel.tsx`, `VideoPreview.tsx`, `timeline.ts` and its tests. Provider/client/schema/save tests, the revision integration suite and the video browser flow cover the changes. The revised MP4 fixture and recorder mode are test-only assets. Emulator scripts, Playwright configuration and `firebase.emulators.test.json` provide the isolated test profile. README/TODO and the API, architecture, cloud, worker, model and local-emulator guides describe the resulting behavior and setup.

## Required access and remaining gates

The credential-presence check found no `apps/api/.env`, process `GEMINI_API_KEY`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_APPLICATION_CREDENTIALS`, real-AI opt-in or video opt-in. `gcloud` and Docker are unavailable. No live Google request, paid edit, container image build, cloud deployment or production IAM verification was performed.

Phase 5 adds no credential, IAM role, queue or index beyond Phase 4. Required setup remains a billed Google Cloud/Firebase project; Firebase public web configuration and enabled Auth providers; Firestore and private Storage; local ADC or runtime service identities; a server Gemini key with paid model access; Cloud Tasks, the private worker and OIDC identity; Secret Manager/IAM; recovery/cleanup schedules; and Hosting/API deployment. The exact steps are in [cloud setup](cloud-setup.md), [worker setup](video-worker-setup.md) and [model verification](model-verification.md). Keep secrets in ignored server configuration or Secret Manager, never chat or browser variables.

Real acceptance requires original artwork, schema-valid live analysis, a genuine initial MP4, a distinct conversational edit, independent playback, a visible requested change, restoration of the prior selection, protected byte-correct download and a failed edit that preserves earlier media. The optional upload path additionally requires a supported region and a stored input at most 10 seconds. None of those real-model outcomes is inferred from fixtures.

Upgrade an existing Phase 4 deployment using the documented coordinated worker-first rollout before allowing edit jobs. An old worker does not understand the new edit job kind. No resources were changed by this local milestone.

Current scope remains one scene/clip, latest 30 versions plus saved selection/parent lookup, browser-only trim/caption preview and whole-file MP4 buffering up to 100 MiB per player. There is no encoded timeline export, multi-clip composition or editable layer extraction from MP4. Production quota, model latency/retention and browser playback still need live verification.
