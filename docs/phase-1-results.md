# Phase 1 implementation report

Date: October 12, 2026 (Pacific/Fiji).

## Delivered

The original repository held three blueprint files. This milestone adds npm workspaces under `apps/web`, `apps/api` and `packages/shared`, strict TypeScript, consistent scripts and a lockfile; the responsive studio/gallery, Firebase Auth and authenticated project client; the Fastify project/scene API and Firestore repository; shared editable-source schemas; real Google AI provider and opt-in server smoke CLI; unit/browser tests; Firebase rules, Dockerfile, CI, README, TODO and cloud/model setup guides.

Project creation writes a default scene with the project in one Firestore batch. All project and descendant routes authenticate and check ownership; updates and duplication recheck ownership transactionally. Client requests cannot set owner IDs. Sources remain typed editable JSON, separate from future generated media. The temporary Konva browser playground is explicitly unsaved. Import, full source editor persistence, integrated analysis, queued jobs, video UI and deployment are not yet implemented.

## Actual local verification

| Command / check | Result |
| --- | --- |
| `npm run typecheck` | PASS for shared, API, smoke scripts/API tests, and web |
| `npm run lint` | PASS |
| `npm run test` | PASS: final run 65 tests across 6 files, including 39 provider/transport tests |
| `npm run build` | PASS: shared and API TypeScript output plus Vite production frontend |
| `npm run test:e2e` | PASS: 2 Chromium tests, desktop and 390px mobile |
| `npm audit --audit-level=low` | PASS: 0 known vulnerabilities after dependency updates |
| `node apps/api/dist/server.js` + real local HTTP requests | PASS: `/health` 200 with `firebaseConfigured:false`; unauthenticated `/api/v1/projects` 401; server then stopped |
| `npm run smoke:analysis`, `smoke:video`, `smoke:edit` without enablement | Each exited 1 with `REAL_AI_DISABLED`; no paid API call and no MP4 |
| Browser production-bundle scan | No `GEMINI_API_KEY`, `@google/genai` or Google generative API endpoint found |
| Ignore checks | API/web local env and smoke artifacts ignored by Git |
| `git diff --check` | PASS |

Unit tests explicitly use test doubles for authentication, persistence and provider responses. They cover owner isolation across project/scene routes, request validation, safe errors, schema round-trip, AI rights/opt-in gates, invalid provider output, edit parent IDs, rate limits, URI restrictions and deadlines. They do not prove actual Firebase credentials, production IAM, model entitlement or rendering.

The browser tests use actual Chromium rendering and pointer input, drawing/undo/redo, unavailable-AI state, unsaved preview reload behavior, no page errors and mobile overflow checks. Desktop screenshots were visually inspected. Screenshots are generated under ignored `test-results/`.

## Fixes during validation

- Removed an extra frontend `aspectRatio` field rejected by the strict project-create API.
- Added required Firebase Auth Viewer permission to the cloud runbook for revoked-token checks.
- Fixed UUID map typing and a PowerShell-written UTF-8 BOM that prevented Vite configuration parsing.
- Changed the Konva playground to load lazily; production JS is split into approximately 442 kB main and 340 kB editor chunks before gzip.
- Fixed provider REST fallback to consider only the latest interaction turn, so an older video cannot masquerade as successful new edit output. Added regression and HTTP transport tests for SDK conversion, credential isolation and hostile redirects.
- Upgraded Firebase Admin to 14.5.x and Vitest to 4.1.11; constrained transitive `@grpc/grpc-js` to a patched compatible 1.x release. The final audit reports zero vulnerabilities.
- npm 10's peer resolver crashed while installing patched Vitest. `npx --yes --package=npm@11 npm install` succeeded. Use npm 11 for a fresh install.
- Windows sandbox restrictions blocked esbuild/tsx and Chromium operations; affected checks were rerun with approved escalation. Chromium was installed for the browser smoke.
- Vite emitted non-failing upstream Zod comment-annotation warnings. No app compilation errors remain.

## External blockers and unverified acceptance gates

- No Gemini API key, explicit paid enablement or original input image was supplied. **No real analysis, generation or edit occurred and no MP4 exists.** Official request formats and SDK types have been checked; actual account access remains unverified.
- Firebase web configuration, Auth provider setup, Firestore database and local ADC are needed to prove real sign-in and project persistence. Repository doubles are not cloud integration evidence.
- Docker, gcloud and Firebase CLI are absent. Docker build, IAM/rule deployment, Hosting, Cloud Run, private media and Cloud Tasks have not been verified or deployed.
- Gate 2 canvas persistence, integrated analysis/video/edit gates, timeline/export and cloud release remain future milestones in `TODO.md`.

Current implementation limits: project listing caps at 100 without pagination; media duplication is explicitly rejected; source image saves are rejected until authorized private assets exist; recursive project deletion needs race-safe cleanup when concurrent jobs/media are introduced. Health indicates process readiness/configuration only, not database or paid-model connectivity.

Every external credential and cloud setup action is documented in [cloud setup](cloud-setup.md). Paid opt-in, model references, original-content affirmation, exact commands and required output evidence are in [model verification](model-verification.md). Do not mark a live gate complete from unit tests or build success.
