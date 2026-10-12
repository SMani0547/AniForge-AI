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
- [ ] Real Firebase login/project persistence verified against emulator or cloud.
- [ ] Real Gemini schema-valid analysis, initial playable MP4 and follow-up edited MP4. Blocked by absent credentials, paid enablement and original source input.

Acceptance: local app and API boot; secure project routes and schemas pass tests; standalone server CLI requests real Google AI only when enabled; no credentials in browser. Gate 1 cloud persistence and model gates stay unverified until configured.

## Phase 2 — editable canvas and private assets

- [ ] Persist canvas from web, debounce/manual save and reload proof.
- [ ] Select/move/resize, shapes/text, editable layers, lock/hide/reorder, bounded undo/redo.
- [ ] Private image upload, signature/type/size validation, rights affirmation, manual panel crop and authorized downloads.
- [ ] Atomic asset references/duplication and reliable deletion cleanup; limit/page project lists beyond 100.
- [ ] Emulator/integration tests and browser test proving a saved edit survives refresh.
- [ ] Run typecheck, lint, tests, build and E2E; record actual results and commit.

Acceptance: a creator-owned image and editable objects survive save/reload at canonical 1920×1080 without embedding image bytes in Firestore.

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
- gcloud, Firebase CLI and Docker unavailable in this environment; cloud deployment/container build cannot be claimed.
- Follow the concrete setup in docs/cloud-setup.md and docs/model-verification.md. Keep secrets in local ignored server .env or Secret Manager, never chat or VITE_*.
