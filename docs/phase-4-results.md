# Phase 4 — queued video generation

Implemented October 12, 2026 (Pacific/Fiji). This report distinguishes application tests from still-unverified Google/cloud integration.

## Delivered

- Strict generation/job/version schemas; saved original snapshot plus revision/shot plan/prompt; mandatory rights and paid-attempt affirmation.
- Firestore transactional per-user daily allowance (default three) and one active job across API instances. Identical IDs replay; conflicting input is rejected. Browser persists pending IDs before dispatch.
- Named Cloud Tasks REST requests authenticated with ADC and exact OIDC audience/identity. Separate worker entry point; internal route is absent from the public API. Worker checks signed Google tokens and rejects spoofed queue headers and Firebase user tokens.
- Durable pre-dispatch reservation, six-minute lease, 30-minute job expiry and safe terminal errors. Completed Google file reference is checkpointed before download. Existing file/storage recovery is bounded to three worker claims; ambiguous create outcomes never automatically regenerate. Provider retains its bounded explicit-429 retries.
- Private, immutable MP4 writes and transactional version publication; interaction IDs and storage paths remain server-only. Deleting projects cannot be resurrected by workers. Existing deletion cleanup covers late media writes.
- Studio confirmation/prompt preview, promptly queued jobs, visible failures, bounded polling retry, authenticated MP4 player and version listing after reload. The saved drawing remains editable while a queued worker runs. No runtime fake AI provider exists.
- Scheduled recovery command, Firestore indexes, server environment examples and [complete queue/worker/IAM/credential runbook](video-worker-setup.md). Conversational editing, persistent version selection, timeline and download controls remain Phase 5.

## Actual verification

| Command | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run test` | 156 tests passed across 13 files |
| `npm run build` | Shared, API/worker and Vite production build passed |
| `npm run test:e2e` | 2 desktop/mobile browser smokes passed |
| `npm run test:emulators` | 27 real Firebase emulator integration/browser tests passed; zero Playwright retries |
| `npm audit --omit=dev` | 0 production vulnerabilities |
| `node scripts/create-video-fixture.mjs` | Recorded our original 5,820-byte geometric MP4, visibly labeled TEST FIXTURE |

The new emulator browser test exercised real Firebase guest auth, Fastify generation routes, Firestore reservation, queued job persistence through reload, worker dispatch, private Storage, version publication, actual Chromium playback progress and playback after another reload. Only the provider and queue delivery are explicitly injected fixtures. The clip is original locally recorded geometry, **not Google output**. Screenshot evidence is in `test-results/emulators` (ignored); regenerate using the test command. Cloud Tasks REST acceptance, Google OIDC signature verification with real tokens, cloud IAM and Google model access were not exercised by those fixtures.

Failure tests cover cross-user access, stale source snapshots, request ID conflict, quota races, duplicate/concurrent workers, abandoned dispatch, retry exhaustion, storage failure, lost publication connection, outbox recovery, expired queues and deletion during generation. The provider fixture test proves checkpoint-before-download and resume without a second create.

The first full emulator run passed 23 tests and failed three existing API tests with 429 responses because cumulative localhost traffic exhausted their shared API counter. Those tests now start an isolated API instance using real Firebase verification and the unchanged production rate limit. The complete rerun passed all 27 tests. No assertion was relaxed and no production limit was increased.

Known nonfatal warnings: upstream Zod/Rollup annotation warnings during build; Firebase Storage Java 25 `Unsafe` warning; existing `PassThrough` MaxListeners warnings in emulator integration tests. The listener warning remains undiagnosed and was not suppressed. npm's full dependency report still has 11 development-tool findings (4 moderate, 7 high) inherited from the Firebase CLI dependency graph; production audit is clean.

## Files and limitations

Primary additions: `apps/api/src/video-ledger.ts`, `video.ts`, `video-config.ts`, `video-queue.ts`, `worker-app.ts`, `worker.ts`, `recover-videos.ts`; `apps/web/src/GenerationPanel.tsx`; job/version shared schemas; worker/provider unit tests; video emulator/browser tests and original MP4 fixture. Existing API, server, provider, storage, client, canvas, indexes, package manifests, lockfile and setup docs were updated. `google-auth-library` is now an explicit production dependency (already present transitively).

No `apps/api/.env`, process Gemini key, real-AI opt-in or video opt-in was present at verification. `gcloud` and Docker are unavailable. No paid Google request, cloud queue creation, token/IAM deployment, real Google MP4, image push or deployment is claimed. Required remaining setup: billed project and paid model entitlement, Firebase web configuration/Auth/Firestore, ADC, private bucket, secret binding, service accounts/IAM, queue, worker, recovery/cleanup schedules and Hosting/API deployment. Follow [cloud setup](cloud-setup.md) and [worker setup](video-worker-setup.md); do not send secrets in chat.

The worker uses the documented synchronous Omni format within an independent queue request; it does not assume Omni background execution support. Its five-minute provider bound must be checked against actual paid model latency. The player buffers up to 100 MiB, and container validation alone does not prove an arbitrary Google MP4 is playable. Latest 30 jobs/versions are shown. Per-user limits do not stop anonymous account cycling or impose a global spending cap; configure controlled demo access and Google project quota/budget before public paid use. These are release limits, not evidence of completed cloud acceptance.
