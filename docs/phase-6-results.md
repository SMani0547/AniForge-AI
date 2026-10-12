# Phase 6: local release preparation

Recorded October 13, 2026 (Pacific/Fiji). The user requested local release preparation first and deferred Google account setup. This phase's local preparation is complete; cloud release and live-model acceptance are not complete. No paid AI request, cloud resource creation, deployment or source upload ran.

## Changes

- `apps/web/release-config.ts`, its tests and Vite configuration validate required public Firebase settings and the HTTPS API endpoint for release mode. They reject emulator/placeholder settings, unapproved `VITE_` names and a Firebase deployment project mismatch without printing values. The normal development build remains usable without credentials.
- Package scripts and `firebase.json` add `build:release` and enforce it through the Hosting predeploy hook. Validation checks syntax and consistency; it does not prove Firebase account access or API reachability.
- `scripts/check-web-artifact.mjs` checks the compiled browser files for known server-secret values/canaries, private-key patterns and prohibited files. This bounded check is not an exhaustive secret audit. Firebase's public Web app key is expected in the browser.
- `scripts/smoke-built-api.mjs` checks actual compiled Fastify HTTP behavior without cloud credentials. `scripts/smoke-container.mjs` prepares network-isolated API/worker startup, nonroot and unauthenticated-request checks. CI includes both commands and a Docker build; the remote CI workflow has not run in this phase.
- `cloudbuild.yaml`, `.gcloudignore` and the expanded [cloud setup](cloud-setup.md) provide an optional remote image-build route, source exclusions and dedicated build identity permissions. Cloud Build is untested here.
- The [release checklist](release-checklist.md), [three-minute demo script](demo-script.md), [eight-slide outline](pitch-outline.md) and [reviewed local screenshot](demo/README.md) distinguish test evidence from the still-required live results. README, environment example and TODO reflect this status.
- The revision browser test captures independently played parent/revision clips after reload. Both are original geometric test fixtures visibly labeled **TEST FIXTURE - NOT AI OUTPUT**. No generated-media claim is made.

## Actual commands and results

| Check | Actual result |
| --- | --- |
| `npm run typecheck` | Passed across workspaces and tooling. |
| `npm run lint` | Passed. |
| `npm test` | Passed: 200 tests in 15 files. Includes three release-configuration tests. |
| `npm run build` with a nonsecret server-only canary | Passed: shared/API compilation, Vite production build and browser artifact check (six files). The canary was absent from the browser output. |
| `npm run test:built-api` | Passed: real local HTTP health, unauthenticated project rejection, internal worker route absent from public API, allowed/foreign CORS behavior. |
| `npm run test:emulators` | Passed: 34 integration/browser tests, zero retries. Final run took 1.4 minutes; Auth, Firestore and Storage used the isolated test profile. |
| `npm run test:e2e` | Passed: two standalone desktop/mobile browser smoke tests. |
| `npm audit --omit=dev` | Zero production dependency vulnerabilities reported. |
| Artifact scanner negative probe | Passed: a temporary synthetic canary file caused a nonzero rejection without printing the value. The file was removed and the clean six-file scan passed again. |
| `npm run build:release -w @aniforge/web` | Expected nonzero result: required Firebase/API configuration is absent. The release guard blocked bundling; no configured release build is claimed. |
| `npm run test:container` | Blocked: Docker is not installed. No container checks ran. |

The emulator suite verifies real local persistence, ownership and recovery behavior with explicitly injected test providers. It does not verify Google model output, production IAM, Cloud Tasks delivery or deployed private storage. The screenshot was visually reviewed and copied directly from the passing browser test; a still image alone does not prove playback.

Existing development emulators were preserved. The test launcher stopped its own isolated emulator processes. Known non-failing tooling warnings remain: Java 25's deprecated `Unsafe` API, test-process `PassThrough` listener warnings, Rollup annotation warnings and Playwright color-variable warnings. No warning was hidden to obtain these results. The production-only audit does not clear the previously recorded development-tool advisories.

## Remaining gates and credentials

At inspection, the process had no `GEMINI_API_KEY`, `GOOGLE_CLOUD_PROJECT` or `GOOGLE_APPLICATION_CREDENTIALS`; server `.env` and web `.env.local` were absent. Neither `gcloud` nor Docker was available. No credentials were inferred or printed.

Before release, follow [cloud setup](cloud-setup.md), [model verification](model-verification.md) and the [release checklist](release-checklist.md):

1. Create a billed Firebase/Google Cloud project, register its Web app, enable sign-in providers and Firestore, configure public Firebase values and the API URL.
2. Configure private storage, service identities/IAM, secrets, queue, indexes, recovery/cleanup schedules and CORS. Install/authenticate the required CLI; build and verify the container locally or through the documented remote route.
3. Supply server-only paid Gemini access and original artwork with permission. Run the opt-in real analysis, initial-generation and follow-up-edit smoke tests; retain actual schema-valid analysis and distinct playable MP4 evidence.
4. Deploy Hosting, API and private worker; verify fresh-user sign-in/save/reload, cross-user denials, private assets, worker identity, recovery and visible failure states. Record real URLs, image digest and model cost/quota observations.
5. Capture the real demonstration and finish the submission video/slide PDF. The current script and outline are preparation, not those finished artifacts.

Keep secret values in ignored local server configuration or Secret Manager, never in chat or browser variables. These are deferred release gates, not simulated successes.
