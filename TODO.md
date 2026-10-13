# AniForge implementation milestones

Updated October 13, 2026 (Pacific/Fiji). This is an implementation record, not evidence of deployment or paid model success.

The separately requested visual redesign is tracked in [UI_UPGRADE_TODO.md](UI_UPGRADE_TODO.md). U1's local visual system, U2's public homepage, U3's project dashboard, U4's source workspace and U5's video workspace are implemented; external reference visual review is pending. U6's accessibility, performance and release review is next. Local UI evidence does not change the live-release status below.

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

- [x] Authorized saved source raster and analysis endpoint; server-only Gemini opt-in, bounded deadlines, durable request replay and per-user attempt limits.
- [x] Editable schema-valid shot plan, loading/error state and prompt preview; explicit suggestion application, revision checks and manual authoring without AI.
- [x] Unit/schema/provider tests with explicit fixtures; no fake runtime AI success.
- [ ] Explicitly enabled live Gemini analysis evidence. Blocked by absent server key/paid opt-in/original input; local provider fixtures do not satisfy this gate.
- [x] Run typecheck, lint, 147 unit tests, build, 2 browser smoke tests and 17 emulator tests; record results in docs/phase-3-results.md and commit the implementation. Live Gemini evidence remains separately blocked above.

Acceptance: an actual Google response yields editable shot-plan data while preserving original source. The implementation and local test work are separate from this still-unverified real-model gate; see docs/phase-3-results.md.

## Phase 4 — queued real video generation

- [x] Job schema/state machine, per-user quota/cost confirmation, Cloud Tasks enqueue and trusted OIDC worker implementation.
- [x] Durable dispatch reservation/checkpoint recovery, bounded retries/timeouts and browser polling without automatic duplicate paid generation.
- [x] Private GCS MP4 storage, immutable version metadata, status polling and player; original labeled test fixture plays after reload with real Firebase emulators.
- [x] Ownership/job-state/worker identity/provider tests. Exact scope and results in docs/phase-4-results.md.
- [ ] Live paid generation evidence and deployed Cloud Tasks/OIDC/recovery verification. No Gemini credentials, cloud setup, gcloud or Docker are available.
- [x] Run phase checks, record actual results and commit the implementation. Real MP4 acceptance remains blocked above.

Acceptance: browser receives a job ID promptly, terminal failures are visible, and a real Google-generated stored MP4 remains playable after reload. The local implementation is verified with an explicitly labeled original MP4 test fixture; it does not satisfy the real-model/cloud gate.

## Phase 5 — revisions, timeline and download

- [x] Conversational edit via retained provider interaction ID; new immutable version with parent pointer and server-only provenance. Explicit stored-MP4 upload mode never runs as an automatic paid fallback.
- [x] Parent/revision comparison, saved selection/revert and prompt history; failed edits preserve existing media and scene data.
- [x] Local trim/caption metadata, original MP4 and timeline JSON downloads with clear browser-preview-only semantics; legacy timelines remain readable and explicitly repairable.
- [x] Provider, schema and client tests for immutable revisions, protected download and shared revision saves. Test-only original/revised geometric clips are labeled fixtures.
- [ ] Real Google conversational-edit evidence, independent original/revised playback and deployed ownership verification. Credentials, paid access and cloud deployment remain required.
- [x] Typecheck, lint, 197 unit tests, build, 34 emulator integration/browser tests and 2 standalone browser tests passed. Production audit has zero findings. Results and limitations recorded in docs/phase-5-results.md; implementation committed as this milestone.

Acceptance: real original and edited MP4 both play independently; selecting an earlier version never overwrites source or media. Implementation and local fixture evidence are recorded separately from the blocked real-model gate in docs/phase-5-results.md.

## Phase 6 — cloud release and demo

- [x] Release-only Firebase/API configuration guard, Hosting predeploy hook and browser artifact secret/canary check.
- [x] Compiled API HTTP smoke; Docker API/worker smoke command and CI steps prepared. Local Docker execution remains blocked below.
- [x] Optional Cloud Build configuration, source upload exclusions and documented least-privilege build setup.
- [x] Three-minute demo script, eight-slide outline, reviewed emulator screenshot and deployment verification checklist.
- [x] Typecheck, lint, 200 unit tests, build, compiled API smoke, 34 emulator tests and 2 standalone browser tests passed; production audit has zero findings. Exact results in docs/phase-6-results.md.
- [ ] User creates/configures billed Google Cloud/Firebase project and Gemini paid access.
- [ ] Apply least-privilege service accounts, private bucket, rules, secrets, queue and CORS.
- [ ] Build/test container; deploy Hosting/API/private worker; verify fresh-user incognito flow.
- [ ] Verify unauthorized project/media access denied and no server secrets shipped to browser.
- [ ] Document actual model cost/quota results, live URLs and demo assets.
- [ ] Capture real Google/cloud evidence, record final demo video and produce the submission slide PDF.

Local release preparation is complete. The user explicitly deferred account setup and deployment. Full Phase 6 acceptance remains pending: all six MVP gates in AGENTS.md must be evidenced, including real initial/edit Google AI calls and deployed private media. Local fixtures do not satisfy those gates.

## Current external blockers

- No GEMINI_API_KEY, GOOGLE_CLOUD_PROJECT or GOOGLE_APPLICATION_CREDENTIALS configured in the starting process environment. No credentials inferred or printed.
- Firebase web configuration, enabled providers, Firestore database and API application-default credentials not supplied.
- Real AI explicitly defaults off; paid account entitlement and an original input image are needed to execute billable smoke tests.
- Firebase CLI 15.33.0 is now a pinned local dependency; actual Firebase emulators ran with the existing Android Studio Java 25 runtime. Local Phase 2 needs no cloud credentials.
- gcloud and Docker were unavailable at environment inspection; cloud deployment/container build cannot be claimed.
- Production cleanup requires the documented Cloud Run Job/Scheduler and Firestore index setup. No cloud resources were created.
- Production dependencies have no npm audit findings; Firebase CLI development dependencies have outstanding advisories recorded in docs/phase-2-results.md.
- Follow the concrete setup in docs/cloud-setup.md and docs/model-verification.md. Keep secrets in local ignored server .env or Secret Manager, never chat or VITE_*.
