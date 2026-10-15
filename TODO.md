# AniForge implementation milestones

Updated October 15, 2026 (Pacific/Fiji). Historical implementation checks are retained below. Current deployment and real-model evidence are recorded in [cloud setup progress](docs/cloud-setup-progress.md) and [video activation results](docs/video-activation-results.md).

**Current live status:** the owner confirmed sign-in/project use and successful scene analysis. Real initial Omni generation, local MP4 playback, deployed checkpoint recovery/private storage, task OIDC and scheduled outbox recovery passed. Video controls are enabled. Fresh signed-in browser generation/reload and real conversational editing remain to be verified. The owner explicitly deferred the separate recurring media-cleanup schedule.

The separately requested visual redesign is tracked in [UI_UPGRADE_TODO.md](UI_UPGRADE_TODO.md). U1's local visual system, U2's public homepage, U3's project dashboard, U4's source workspace and U5's video workspace are implemented; external reference visual review is pending. U6's local accessibility, performance and release review passed; production release gates remain pending. Local UI evidence does not change the live-release status below.

## Phase 1 — foundation and model proof of concept

**Cloud setup checkpoint (October 13):** project `aniforge-511502`, ADC access and enabled Google provider verified; Firestore rules/index definitions deployed. Billing is active, all required indexes are ready, and private bucket creation plus real SDK write/read and anonymous-access denial checks passed. Browser persistence remains unverified. See [live setup progress](docs/cloud-setup-progress.md); live AI and deployment gates remain open.

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
- [x] Real Gemini schema-valid analysis and initial playable Omni MP4; October 15 evidence linked above.
- [ ] Real follow-up edited MP4 with independent original/revised playback.

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
- [x] Explicitly enabled real Gemini analysis passed; the owner confirmed the deployed suggestion worked and was applied on October 15.
- [x] Run typecheck, lint, 147 unit tests, build, 2 browser smoke tests and 17 emulator tests; record results in docs/phase-3-results.md and commit the implementation. Live Gemini evidence remains separately blocked above.

Acceptance: an actual Google response yields editable shot-plan data while preserving original source. Real-model analysis passed on October 15, separately from the earlier local fixtures in docs/phase-3-results.md.

## Phase 4 — queued real video generation

- [x] Job schema/state machine, per-user quota/cost confirmation, Cloud Tasks enqueue and trusted OIDC worker implementation.
- [x] Durable dispatch reservation/checkpoint recovery, bounded retries/timeouts and browser polling without automatic duplicate paid generation.
- [x] Private GCS MP4 storage, immutable version metadata, status polling and player; original labeled test fixture plays after reload with real Firebase emulators.
- [x] Ownership/job-state/worker identity/provider tests. Exact scope and results in docs/phase-4-results.md.
- [x] Real paid initial generation and playback; deployed Cloud Tasks/OIDC, checkpoint recovery, private storage and scheduled recovery verified October 15.
- [ ] Fresh signed-in production generation queues promptly, plays after reload and downloads through the API; provider smoke and cloud checkpoint recovery are separate evidence.
- [x] Run phase checks, record actual results and commit the implementation. Real MP4 acceptance remains blocked above.

Acceptance: browser receives a job ID promptly, terminal failures are visible, and a real Google-generated stored MP4 remains playable after reload. The local implementation is verified with an explicitly labeled original MP4 test fixture; it does not satisfy the real-model/cloud gate.

## Phase 5 — revisions, timeline and download

- [x] Conversational edit via retained provider interaction ID; new immutable version with parent pointer and server-only provenance. Explicit stored-MP4 upload mode never runs as an automatic paid fallback.
- [x] Parent/revision comparison, saved selection/revert and prompt history; failed edits preserve existing media and scene data.
- [x] Local trim/caption metadata, original MP4 and timeline JSON downloads with clear browser-preview-only semantics; legacy timelines remain readable and explicitly repairable.
- [x] Provider, schema and client tests for immutable revisions, protected download and shared revision saves. Test-only original/revised geometric clips are labeled fixtures.
- [ ] Real Google conversational-edit evidence, independent original/revised playback and deployed ownership verification. Credentials and worker deployment are now available; the real edit acceptance test remains outstanding.
- [x] Typecheck, lint, 197 unit tests, build, 34 emulator integration/browser tests and 2 standalone browser tests passed. Production audit has zero findings. Results and limitations recorded in docs/phase-5-results.md; implementation committed as this milestone.

Acceptance: real original and edited MP4 both play independently; selecting an earlier version never overwrites source or media. Implementation and local fixture evidence are recorded separately from the blocked real-model gate in docs/phase-5-results.md.

## Phase 6 — cloud release and demo

- [x] Release-only Firebase/API configuration guard, Hosting predeploy hook and browser artifact secret/canary check.
- [x] Compiled API HTTP smoke; Docker API/worker smoke command and CI steps prepared. Local Docker execution remains blocked below.
- [x] Optional Cloud Build configuration, source upload exclusions and documented least-privilege build setup.
- [x] Three-minute demo script, eight-slide outline, reviewed emulator screenshot and deployment verification checklist.
- [x] Typecheck, lint, 200 unit tests, build, compiled API smoke, 34 emulator tests and 2 standalone browser tests passed; production audit has zero findings. Exact results in docs/phase-6-results.md.
- [x] User creates/configures billed Google Cloud/Firebase project and Gemini paid access; analysis and initial video requests succeeded.
- [x] Apply scoped service accounts, private bucket, rules, secrets, queue and CORS; verification recorded in cloud/video setup reports.
- [ ] Build/test container; deploy Hosting/API/private worker; verify fresh-user incognito flow.
- [ ] Verify unauthorized project/media access denied and no server secrets shipped to browser.
- [ ] Document actual model cost/quota results, live URLs and demo assets.
- [ ] Capture real Google/cloud evidence, record final demo video and produce the submission slide PDF.

Local release preparation and API/worker activation are complete; Hosting is accessible at the custom domain. Full Phase 6 acceptance remains pending: fresh-user browser verification, a real follow-up edit and final demo evidence are still required. Real initial video and deployed private-media evidence are now recorded separately from local fixtures.

## Current external blockers

- Fresh authenticated production video-generation/reload and real original/revised playback remain unverified. Actual model charges and remaining balance were not read.
- Server credentials, Firebase setup, ADC and paid analysis/initial-video access are now configured and verified. Existing protected configuration stays outside version control; no downloaded service-account key is needed.
- Firebase CLI 15.33.0 is now a pinned local dependency; actual Firebase emulators ran with the existing Android Studio Java 25 runtime. Local Phase 2 needs no cloud credentials.
- Cloud Build, gcloud and deployed API/worker verification succeeded. Local Docker runtime checks remain separate from the deployed image evidence.
- Video outbox recovery is scheduled and verified. The separate recurring media-cleanup job/schedule remains deferred by the owner's explicit choice after automatic approval review rejected its deletion capability.
- Production dependencies have no npm audit findings; Firebase CLI development dependencies have outstanding advisories recorded in docs/phase-2-results.md.
- Follow the concrete setup in docs/cloud-setup.md and docs/model-verification.md. Keep secrets in local ignored server .env or Secret Manager, never chat or VITE_*.
