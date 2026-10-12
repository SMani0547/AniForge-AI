# Phase 2 execution report

Verified October 12, 2026 (Pacific/Fiji) on Windows, Node 24.19.0, Chromium and the existing Android Studio Java 25 runtime. This records local implementation and actual test results, not production deployment or paid AI success.

## Working functionality

- Authenticated projects open a saved Konva editor at canonical 1920×1080 coordinates. Pencil/brush/eraser, shapes/text, selection, move/resize/rotate, inspector, layers, hide/lock/reorder, bounded undo/redo and zoom/pan operate on validated source JSON.
- Manual save and debounced autosave persist through the API to Firestore. Serialized revision-checked writes preserve edits made during a request. A two-tab conflict retains local changes for JSON download and requires an explicit reload; it cannot silently overwrite the winning save.
- PNG/JPEG/WEBP imports require original-content affirmation and crop confirmation. The authenticated API checks signatures, decodes bounded still images, rejects animated PNG/WEBP, applies orientation, strips metadata and stores a normalized private PNG. Editable crop metadata survives refresh and can be changed afterward.
- Asset metadata and image bytes require Firebase token/ownership checks. Images load through temporary Blob URLs. Project duplication publishes only after independent image copies and scene records are ready; source changes abort the copy. Deletion removes media and descendants with durable retry records.
- Project pagination exposes more than 100 projects. Tests use 105 records and check cursor ownership.
- `npm run dev:emulators` launches actual local Firebase Auth, Firestore and Storage, API, web and Emulator UI, without accounts, billing or secrets. The demo environment ignores personal `.env` files, strips inherited cloud credentials and disables real AI. Auth emulators and the API bind to loopback. Production refuses emulator environment variables.

The no-sign-in sketch playground remains explicitly unsaved. The saved studio's AI controls remain disabled pending later milestones.

## Executed checks

| Command/check | Actual result |
| --- | --- |
| `npm run typecheck` | Passed all workspaces, API scripts, Playwright configs and integration test TypeScript |
| `npm run lint` | Passed; downloaded emulator/cache artifacts are excluded |
| `npm run test` | **98 passed**, 9 files; explicit provider/repository test doubles remain unit-test fixtures |
| `npm run build` | Passed shared, API and production frontend builds |
| `npm run test:e2e` | **2 passed**: desktop playground/drawing and mobile fit |
| `npm run test:emulators` | **10 passed** against actual local Firebase services, including a Chromium saved-editor flow |
| `npm audit --omit=dev --audit-level=low` | Passed, **0 vulnerabilities** in production dependencies |
| `npm audit --json` | Exit 1: **11 development-tool findings**, 4 moderate and 7 high, associated with Firebase CLI/transitive dependencies |
| `git diff --check` | Passed; Git emitted only line-ending normalization notices |
| Frontend output scan | No `GEMINI_API_KEY`, Google AI SDK/provider URL or Firebase Admin identifiers found in `apps/web/dist` |
| `npm run dev:emulators` manual preflight | API, Vite and Emulator UI returned HTTP 200; Windows Ctrl+C shutdown and released ports verified |

The ten emulator tests comprise one browser flow, three API integration cases and six storage/recovery cases. They verify real anonymous Auth tokens, denied direct Firestore/Storage access, another user's denied project/image access, editable JSON equality after browser refresh, crop edits and undo/redo, two-tab save conflict/download/reload, simultaneous revision writers, pagination, independent duplicates, and recoverable failed/interrupted upload/copy/delete operations. Failure-injection tests deliberately throw storage errors against real emulator-backed data; they never substitute a successful cloud result.

Browser screenshots were visually inspected after reload and at a recoverable save conflict. Reproduce artifacts under `test-results/emulators` with the emulator command; unconfigured smoke output is separated under `test-results/unconfigured`. Test media is an original, locally generated geometric PNG. It is not an AI result or a copied character.

## Issues found and resolved during verification

- Restricted Windows execution blocked some esbuild/Java/browser subprocess calls; the same commands passed with approved execution permissions.
- npm 10 hit an internal installation failure. Dependency installation succeeded with npm 11; the README recommends npm 11. No lockfile was hand-forged.
- Sharp's initial version carried a production dependency advisory; upgrading to 0.35.5 cleared the production audit.
- Sharp can silently flatten APNG while omitting animation metadata. A bounded PNG chunk check and regression test now reject the animation control chunk.
- Tooling typecheck found inferred `any` values in a pagination test; explicit types fixed them.
- ESLint initially scanned the downloaded Firebase Emulator UI. `.cache` and emulator exports are now ignored, while application/test lint remains enabled.
- A concurrent shared-package build caused Vite hot reload during a two-tab browser test. Test-mode Vite now disables watching/HMR; the development launcher retains HMR. The complete browser suite then passed.
- Windows signal forwarding could force-stop the Firebase CLI before Java cleanup. The launcher now lets console Ctrl+C reach the CLI; shutdown was retested successfully.

Build warnings remain from two misplaced upstream Zod `@__PURE__` comments; Rollup removes those comments and completes successfully. Java 25 can warn about deprecated `sun.misc.Unsafe`; this did not fail the emulator suite. CI is configured for Java 21, but remote GitHub Actions execution has not been observed.

The development audit findings involve `firebase-tools`, `chokidar`/`braces`, `proxy-agent`/`pac-proxy-agent`/`get-uri`/`basic-ftp`, `gaxios`/`uuid`, and `@google-cloud/pubsub`/`@opentelemetry/core`. The CLI is pinned at 15.33.0. No forced CLI downgrade or incompatible transitive override was applied. These findings remain open; the full dependency audit is not clean.

## Changed areas

| Area | Principal files |
| --- | --- |
| Shared contracts | `packages/shared/src/index.ts`, `schemas.test.ts`: revisions, crop/assets and paginated project response |
| API/private media | `apps/api/src/app.ts`, `repository.ts`, `server.ts`, `config.ts`, `assets/*`, `cleanup.ts`, API tests and `apps/api/package.json` |
| Saved editor | `apps/web/src/CanvasEditor.tsx`, `CanvasObjectView.tsx`, `ImageCropInspector.tsx`, `ImportDialog.tsx`, `editor.ts`, `sceneSaver.ts`, `navigationGuard.ts`, App/API/styles and tests |
| Emulator/browser verification | `scripts/*`, `firebase.emulators.json`, `playwright*.config.ts`, `tests/integration/*`, `tests/e2e/canvas.emulator.spec.ts`, `tsconfig.tooling.json` |
| Build/deployment/docs | root package/lockfile, CI, ignore/lint files, `firebase.json`, `firestore.indexes.json`, README, TODO, architecture/API/cloud/local-emulator guides and this report |

## Limits and outstanding gates

1. No paid Google AI request or MP4 was produced. Gemini entitlement, server credentials and a creator-owned input are still needed for the live smoke tests and later analysis/generation gates. Unit provider fixtures do not satisfy those gates.
2. No production Google sign-in, cloud database/storage IAM, container build, Firebase Hosting or Cloud Run deployment was verified. gcloud/Docker were unavailable at environment inspection. Cloud setup can wait while working locally.
3. Emulator data survives browser refresh but resets when the suite restarts. It is not durable cloud storage or a backup. The current studio edits the project's initial scene; adding/managing multiple scenes remains later work.
4. Source images removed from a canvas remain private until project deletion, supporting undo and saved references. Copies include only currently referenced images. Deleted projects retain a minimal identifier/owner/timestamp tombstone indefinitely for late-write cleanup; a bounded retention/scan strategy is needed before high-volume use.
5. Production recovery needs the documented Firestore collection-group index and a Cloud Run cleanup Job/Scheduler. In-process timers are only supplemental. Local recovery tests passed; no production recovery schedule was created. Image-decoding capacity also needs production load verification.
6. Integrated Gemini analysis is Phase 3. Queued video, immutable conversational versions, timeline/download and deployment remain later phases.

See [local setup](local-emulators.md), [all required cloud credentials and setup steps](cloud-setup.md), [real model verification](model-verification.md), and [milestone checklist](../TODO.md).
