# Phase 3 execution report

Verified October 12, 2026 (Pacific/Fiji). The scene-analysis implementation is complete and locally tested. **The real Gemini acceptance gate is still unverified:** there is no server `.env`, process `GEMINI_API_KEY`, or real-AI opt-in. No live Google analysis, video or edit request was made, and no MP4 was generated.

## Implemented behavior

- The saved studio supports manually authored shot plans, every structured plan field, subject editing, preservation constraints, uncertainties and a prompt preview. Canvas and plan save together with serialized revision checks. Invalid drafts remain local with an explanation and a downloadable scene; conflicts preserve local work.
- An authenticated configuration-status endpoint reports whether analysis is configured without calling Google or claiming entitlement. The normal server constructs only the real Google provider; the emulator launcher keeps it disabled.
- Analysis requires explicit content-rights and possible-charge consent. The browser saves the current scene and renders fresh Konva nodes into a canonical 1920×1080 PNG. It loads authorized source images, applies crop/transforms/opacity and eraser behavior, and excludes editor zoom, pan, selection handles and loading placeholders. Missing image data prevents dispatch.
- The PNG is uploaded privately. The analysis endpoint verifies project/scene ownership, saved revision, visible source content and snapshot metadata. It accepts no external image URL or client-selected model. The raster is a browser export, not a server proof that its pixels exactly reproduce the editable JSON.
- Firestore atomically reserves an analysis ID and per-user allowance before calling Google. Identical completed requests replay their recorded result; pending, failed or changed-input requests cannot silently create another paid call. Attempts default to 20 per UTC day with a 90-second per-user reservation. Ambiguous failures retain that reservation until it expires.
- The analysis-specific provider uses the installed Google SDK and verified Interactions image/structured-output interface, independently of video configuration. A five-second private-storage preflight bound prevents late dispatch; the provider deadline defaults to 40 seconds and is capped at 45 seconds. The browser allows 55 seconds. Only explicit provider 429 rejection is retried within that deadline.
- A result must pass the strict shared shot-plan schema before the analysis record is marked successful. Provider interaction IDs remain server-only. Suggestions are separate from saved content and require **Apply suggestion to shot plan**. Stale local document/revision suggestions are blocked; saving still rejects cross-tab conflicts. Errors preserve the source and prior plan.
- **Retry same analysis** keeps the original snapshot, notes and request ID, including after a pending response. Starting a new analysis is an explicit separate action that may incur another charge.

## Actual verification

| Command/check | Result |
| --- | --- |
| `npm run typecheck` | Passed all workspaces, API scripts and test/config TypeScript |
| `npm run lint` | Passed |
| `npm run test` | **147 passed**, 12 files |
| `npm run build` | Passed shared, API and production frontend builds |
| `npm run test:e2e` | **2 passed**, desktop playground and mobile smoke |
| `npm run test:emulators` | **17 passed**, final complete run in 40.8 seconds |
| `npm audit --omit=dev --audit-level=low` | Passed, **0 production vulnerabilities** |
| `git diff --check` | Passed; only Windows line-ending normalization notices |
| Browser bundle scan | No Gemini key identifier, provider URL, Google AI SDK or Firebase Admin identifiers found in `apps/web/dist` |

The emulator suite uses actual local Firebase Auth, Firestore and Storage. Its new tests verify manual plans with real AI off, durable replay, simultaneous reservations across service instances, attempt limits, ambiguous failures, stale/foreign snapshot rejection and deletion during analysis without recreating private data.

The analysis browser test starts an isolated API with an **explicitly labeled model fixture**. Only the model is replaced: the browser, API, token verification, private upload and database operations use the application implementation and real emulators. It verifies the PNG's dimensions and exact pixels for the background, drawn rectangle and cropped private image at 50% editor zoom. It confirms the suggestion does not overwrite the saved plan until Apply, edited plans survive refresh, failed analysis leaves prior content intact, and retry does not invoke the fixture again. This proves local integration, not Google model behavior.

Browser screenshots were visually inspected. Reproducible artifacts under `test-results/emulators` include `canonical-private-snapshot.png` and `reviewed-test-fixture-plan.png`; they are ignored by Git. Artwork is original geometric test imagery and the fixture plan is visibly labeled. It is not presented as a generated live result.

## Findings and fixes

- Review found that slow database/storage work could outlive the user reservation before provider dispatch. The bounded preflight and post-await deadline checks now prevent late calls; tests cover delayed reads and delayed reservations.
- Browser testing initially failed on exact label selectors for populated textareas and the zoom select, plus the existing canvas test's renamed download button. Accessible-role selectors and the updated **Download local scene** name fixed those tests. The final full suite passed.
- Pending-request responses initially would have hidden the same-ID retry action. Preserving the API error code now keeps that safe recovery action available for `ANALYSIS_PENDING`.
- Existing upstream Zod annotation warnings remain in the successful build. Java 25 emits a deprecated `sun.misc.Unsafe` warning. The expanded emulator suite also emits `MaxListenersExceededWarning` from a `PassThrough` stream; its source has not been diagnosed. These warnings were not suppressed, and all final checks exited successfully.
- Dependency manifests and lockfile were unchanged in Phase 3. The development-only Firebase CLI advisories recorded in [Phase 2](phase-2-results.md) remain outstanding; a clean production audit does not imply a clean full development audit.

## Files changed

| Area | Principal files |
| --- | --- |
| Shared boundary | `packages/shared/src/index.ts`, `schemas.test.ts`: request/result/status contracts, mandatory consent, strict input/output tests |
| API | `apps/api/src/analysis.ts`, `analysis-ledger.ts`, `analysis.test.ts`, `app.ts`, `server.ts`, `config.ts`, `.env.example` |
| Real provider | `apps/api/src/ai/config.ts`, `config.test.ts`, `provider.ts`, `provider.test.ts`, `google-transport.ts`, transport tests and safe errors |
| Editor | `apps/web/src/AnalysisPanel.tsx`, `CanvasEditor.tsx`, `snapshot.ts`, snapshot tests, `sceneSaver.ts`, API client/tests and styles |
| Integration | `tests/e2e/analysis.emulator.spec.ts`, updated canvas smoke, `tests/integration/analysis.emulator.spec.ts`, explicit analysis fixture |
| Documentation | README, TODO, API/architecture/cloud/local-emulator/model guides and this report |

## Required setup and remaining gates

1. For local manual editing, run `npm run dev:emulators`. No cloud credentials or billing are required. Emulator data resets on suite restart; it is not a durable backup.
2. For the real provider smoke test, supply a server-side Gemini key, explicit `ENABLE_REAL_AI=true`, model access/billing and an original image with rights affirmation. The analysis model is independent of video entitlement. See [model setup and exact smoke commands](model-verification.md).
3. For live analysis inside the studio, additionally configure Firebase web Auth, enabled providers, Firestore, ADC/runtime IAM and the private bucket. The new settings are `ANALYSIS_TIMEOUT_MS=40000` and `MAX_ANALYSES_PER_USER_PER_DAY=20`. Complete steps and Cloud Run configuration are in [cloud setup](cloud-setup.md).
4. No container build, production IAM, Firebase Hosting, Cloud Run or scheduled cleanup deployment was verified. Existing private-media recovery deployment requirements still apply.
5. Daily attempt limits and bounded reservations are application controls, not a billing cap. Anonymous accounts are distinct users, and an upstream timeout may still incur a charge. Inspect provider activity before explicitly starting another request.
6. Analysis snapshots/results remain private until project deletion. Per-user usage records persist separately. A crashed pending request is deliberately not re-dispatched; there is no analysis-history/recovery UI after browser reload yet. Applied shot plans persist normally, but an unapplied suggestion and the browser's in-memory retry ID are not restored after reload.
7. Real schema-valid Gemini output is required before marking MVP gate 3 complete. Queued video generation, immutable video revisions, timeline/download and final deployment remain later milestones.
