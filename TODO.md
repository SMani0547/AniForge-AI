# AniForge implementation milestones

Updated October 12, 2026 (Pacific/Fiji). This is an implementation record, not evidence of deployment or paid model success.

## Phase 1 — foundation and model proof of concept

- [x] Inspect BUILD_PLAN.md, CODEX_MASTER_PROMPT.md and AGENTS.md. Initial repository contained only these three files.
- [x] Strict TypeScript npm workspaces: React/Vite/Tailwind/Konva web, Fastify API, shared Zod schemas.
- [x] Firebase Google sign-in and explicitly enabled anonymous sign-in; clear missing-configuration state.
- [x] Authenticated project gallery and owner-only create/read/rename/duplicate/delete API, Firestore repository, default scene creation.
- [x] Canonical editable scene schema, JSON validation and scene read/update API.
- [x] Local unsaved canvas preview, with no fake project persistence or AI results.
- [x] Server-only real Gemini analysis and Omni generation/edit smoke commands, opt-in gate, safe failures, original-content affirmation.
- [x] Verify current official Omni request/response and structured-output docs; pin tested SDK in lockfile.
- [x] Firebase rules, root-context Dockerfile, CI, complete credential/cloud runbook.
- [x] Typecheck, lint, unit tests, production build, browser smoke and dependency audit pass. Exact results and limitations in docs/phase-1-results.md.
- [x] Real Firebase anonymous login/project persistence verified against Google's local emulators in Phase 2. Production Google sign-in/IAM remain unverified.
- [ ] Real Gemini schema-valid analysis, initial playable MP4 and follow-up edited MP4. Blocked by absent credentials, paid enablement and original source input.

Acceptance: local app and API boot; secure project routes and schemas pass tests; standalone server CLI requests real Google AI only when enabled; no credentials in browser. Local Gate 1 is now evidenced by emulator tests. Production persistence and real model gates stay unverified until configured.

## Phase 2 — editable canvas and private assets

- [x] Persist canvas from web, debounce/manual save and reload proof; revision conflicts retain local edits for download/recovery.
- [x] Select/move/resize/rotate, shapes/text, editable layers, lock/hide/reorder, bounded undo/redo, zoom/pan.
- [x] Private image upload, signature/type/size validation, rights affirmation, manual panel crop and authorized downloads; crop remains editable after reload.
- [x] Transactional asset references/duplication and durable deletion recovery; project lists paginated and tested with 105 projects.
- [x] Actual Auth/Firestore/Storage emulator integration and browser test proving a saved edit survives refresh. Credential-free launcher and setup guide included.
- [x] Run typecheck, lint, 98 unit tests, build, 2 unconfigured browser tests and 10 real-emulator integration/browser tests; record actual results in docs/phase-2-results.md and commit this milestone.

Acceptance: a creator-owned image and editable objects survive save/reload at canonical 1920×1080 without embedding image bytes in Firestore. Evidenced locally with actual emulators; see docs/phase-2-results.md. Cloud media/IAM and scheduled cleanup deployment remain release gates.

## Phase 3 — scene analysis in the studio

- [ ] Authorized saved source raster and analysis endpoint; request limits and Gemini opt-in.
- [ ] Editable schema-valid shot plan, loading/error state and prompt preview.
- [ ] Unit/schema tests and explicitly enabled live analysis evidence.
- [ ] Run all phase checks, record results and commit.

Acceptance: an actual Google response yields editable shot-plan data while preserving original source.

## Phase 4 — queued real video generation

- [ ] Job schema/state machine, per-user quota/cost confirmation, Cloud Tasks enqueue and trusted OIDC worker.
- [ ] Durable idempotent dispatch/polling, bounded retries and timeouts without duplicate paid generation.
- [ ] Private GCS MP4 storage, immutable version metadata, status polling and player.
- [ ] Ownership/job-state/worker identity/provider tests; live paid generation evidence.
- [ ] Run all phase checks, record results and commit.

Acceptance: browser receives a job ID promptly, terminal failures are visible, and a real stored MP4 remains playable after reload.

## Phase 5 — revisions, timeline and download

- [ ] Conversational edit via retained provider interaction ID; new immutable version with parent pointer.
- [ ] Compare/select earlier version; preserve both on failure.
- [ ] Local trim/caption metadata, selected-clip download and honest unrendered overlay semantics.
- [ ] Version immutability and ownership tests; actual edited-video evidence.
- [ ] Run all phase checks, record results and commit.

Acceptance: original and edited MP4 both play independently; selecting an earlier version never overwrites source or media.

## Phase 6 — cloud release and demo

- [ ] User creates/configures billed Google Cloud/Firebase project and Gemini paid access.
- [ ] Apply least-privilege service accounts, private bucket, rules, secrets, queue and CORS.
- [ ] Build/test container; deploy Hosting/API/private worker; verify fresh-user incognito flow.
- [ ] Verify unauthorized project/media access denied and no server secrets shipped to browser.
- [ ] Document actual model cost/quota results, live URLs and demo assets.
- [ ] Prepare demo script, screenshot evidence and 8-slide outline; final checks and commit.

Acceptance: all six MVP gates in AGENTS.md evidenced, including real initial/edit Google AI calls and deployed private media.

## Current external blockers

- No GEMINI_API_KEY, GOOGLE_CLOUD_PROJECT or GOOGLE_APPLICATION_CREDENTIALS configured in the starting process environment. No credentials inferred or printed.
- Firebase web configuration, enabled providers, Firestore database and API application-default credentials not supplied.
- Real AI explicitly defaults off; paid account entitlement and an original input image are needed to execute billable smoke tests.
- Firebase CLI 15.33.0 is now a pinned local dependency; actual Firebase emulators ran with the existing Android Studio Java 25 runtime. Local Phase 2 needs no cloud credentials.
- gcloud and Docker were unavailable at environment inspection; cloud deployment/container build cannot be claimed.
- Production cleanup requires the documented Cloud Run Job/Scheduler and Firestore index setup. No cloud resources were created.
- Production dependencies have no npm audit findings; Firebase CLI development dependencies have outstanding advisories recorded in docs/phase-2-results.md.
- Follow the concrete setup in docs/cloud-setup.md and docs/model-verification.md. Keep secrets in local ignored server .env or Secret Manager, never chat or VITE_*.
