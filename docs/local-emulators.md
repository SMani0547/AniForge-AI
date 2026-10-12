# Local Firebase development

Phase 2 can run without a Firebase account, billing, Gemini key, service-account file, or a cloud project. The launcher uses Google's real Firebase Auth, Firestore, and Storage emulators with the demo project ID `demo-aniforge`. It runs the actual Fastify API and React editor. It does not bypass authentication or simulate AI output.

## Prerequisites

- Node.js 24 and the repository's dependencies (`npm install`). `firebase-tools` is a pinned local development dependency; no global CLI install or Firebase login is required.
- Java 21 or newer, available through `PATH` or `JAVA_HOME`. On Windows the launcher also detects Android Studio's bundled Java at `C:\Program Files\Android\Android Studio\jbr`. That existing Java 25 runtime was used for the initial local verification; CI uses Java 21.
- Internet access for the first download of official emulator binaries into `.cache/firebase/emulators`. Later runs reuse these files. Development mode also downloads the official Emulator UI on first use.
- Chromium for browser tests: `npx playwright install chromium`. Linux CI additionally needs Playwright's system libraries (`npx playwright install --with-deps chromium`).

To select a Java installation for the current PowerShell session only:

```powershell
$env:JAVA_HOME = 'C:\path\to\jdk-21'
npm run dev:emulators
```

No permanent PATH or system configuration change is needed. Java 25 can emit warnings about deprecated `sun.misc.Unsafe` calls inside Google's emulator jars; the verified test run still completed successfully.

## Start the editor

```powershell
npm run dev:emulators
```

Open <http://127.0.0.1:5173>, choose **Continue as a guest**, then create/open a project. Import an original PNG/JPEG/WEBP, affirm your permission to use it, select a crop, and edit the canvas. Wait for **Saved · revision N** before refreshing. Image bytes remain in the local Storage emulator; editable object JSON remains in the local Firestore emulator.

Phase 3 also includes **Create manual shot plan** below the canvas. Fill the required direction fields and animation prompt; valid plans save with the canvas and survive refresh. Incomplete drafts stay local and are not saved until valid. **Analyze scene** explains that real AI is disabled in this launcher. A local manual plan is user-authored, not a Gemini response.

The development processes stop with Ctrl+C. Emulator data is temporary and resets when the emulator processes restart. Browser refresh is supported; restarting the local suite is not a durable cloud backup. After a restart, use a fresh browser context or sign out and sign in again if the old guest account no longer exists.

| Service | Local address |
|---|---|
| Editor | `http://127.0.0.1:5173` |
| Fastify API | `http://127.0.0.1:8080` |
| Emulator UI (development only) | `http://127.0.0.1:4000` |
| Auth emulator | `127.0.0.1:9099` |
| Firestore emulator | `127.0.0.1:8081` |
| Storage emulator | `127.0.0.1:9199` |
| Emulator hub | `127.0.0.1:4400` |

Firestore also uses port 9150 for its diagnostic WebSocket; emulator logging uses port 4500. Tests use a separate port profile and temporary hub directory, so you can keep this development session and its data running while checks execute. The test harness refuses to reuse an existing API or web server.

| Service | Isolated test address |
|---|---|
| Test editor | `http://127.0.0.1:15173` |
| Test Fastify API | `http://127.0.0.1:18080` |
| Test Auth emulator | `127.0.0.1:19099` |
| Test Firestore emulator | `127.0.0.1:18081` |
| Test Storage emulator | `127.0.0.1:19199` |
| Test emulator hub | `127.0.0.1:14400` |
| Test Firestore diagnostic WebSocket | `127.0.0.1:19150` |
| Test emulator logging | `127.0.0.1:14500` |

The test Emulator UI is disabled; port 14000 is reserved in its configuration. The separate unconfigured browser smoke (`npm run test:e2e`) uses port 15174. Neither suite stops or writes into the development emulator services.

## Run the real local integration checks

```powershell
npm run test:emulators
```

This builds shared schemas, launches a fresh suite, starts the API and web server, runs Playwright, and shuts the processes down. The test web server disables hot reload to prevent a concurrent build from resetting browser state. Its underlying CLI invocation is:

```text
firebase emulators:exec --only auth,firestore,storage --project demo-aniforge --config firebase.emulators.test.json "node scripts/emulator-run.mjs test"
```

Use the npm wrapper so Java selection and the isolated environment are applied. Default `npm run test:e2e` still tests the explicitly unsaved playground without Firebase; it does not include these emulator tests.

The emulator suite verifies:

- Real anonymous Auth tokens accepted by Firebase Admin; missing tokens and other users denied by API ownership checks. Direct Firestore and Storage client access is also denied by rules.
- Browser create/import/manual crop/draw/undo/redo/layer lock and visibility, editable scene save, browser reload, and further position/crop edits to the same persisted objects. The original fixture is a locally generated geometric PNG.
- Optimistic revision conflicts, including two simultaneous writers, without overwriting the winning save. In two browser tabs, the losing edit remains downloadable as source JSON before the user reloads the winning scene.
- More than 100 projects are reachable through pagination; cursors cannot be reused by another owner.
- Independent private media copies survive deletion of the original project; project deletion removes stored bytes and child documents.
- Injected storage failures and concurrent deletion/edits remain recoverable against the actual emulators. These tests intentionally fail storage operations to check rollback and cleanup; no success response is substituted.
- Manual shot-plan persistence with real AI off; canonical 1920×1080 snapshot pixels, explicit suggestion review/apply, saved plan reload and provider failure preservation. The analysis browser test starts an isolated API with an explicitly labeled model fixture; authentication, database and private media still use real Firebase emulators. It is not evidence of a Google response.
- Durable analysis request replay, concurrent reservations, daily attempt limits, ambiguous failures, stale/foreign inputs and deletion while analysis is running. Model fixtures are injected only by tests; the development API has no hidden fake-success provider.

Screenshots and failed-test traces are written under `test-results/emulators`. Logs and downloaded emulator files are ignored by Git. Restricted Windows sandboxes may need permission to launch the Java/browser/Node child processes; an `uv_os_get_passwd`/`ENOMEM` failure was resolved during verification by running the same command with approved execution permissions.

## Isolation and limits

`scripts/emulator-env.mjs` keeps only OS/runtime environment settings and supplies a fixed demo configuration. It strips inherited cloud credentials and arbitrary `VITE_*` values, uses profile-specific Firebase CLI config directories under `.cache/firebase/config/dev` and `.cache/firebase/config/test`, disables metadata-server discovery, and forces `ENABLE_REAL_AI=false` and `ENABLE_VIDEO_GENERATION=false`. The launcher explicitly propagates `ANIFORGE_EMULATOR_PROFILE=dev|test` to every child. Test temporary files and Firebase's project-named hub locator stay under `.cache/firebase/test-tmp`, separate from development. All test suites require the test profile, exact `demo-aniforge` project, and fixed test endpoints before accessing data. The API launcher does not load `.env`; the Vite launcher uses `envDir: false` and routes API calls to the matching profile's API port. Your personal `.env` files are not read or modified by this workflow.

Emulators prove local application integration, not paid Gemini availability, production IAM, signed Google tokens, production database indexes, cloud durability, or deployment. The live cloud and model checks remain separate, documented in [cloud setup](cloud-setup.md) and [model verification](model-verification.md).

Official references: [Emulator Suite setup](https://firebase.google.com/docs/emulator-suite/install_and_configure), [demo projects and Firestore connections](https://firebase.google.com/docs/emulator-suite/connect_firestore), [Auth connections](https://firebase.google.com/docs/emulator-suite/connect_auth), and [Storage connections](https://firebase.google.com/docs/emulator-suite/connect_storage). Firebase Admin expects `FIREBASE_AUTH_EMULATOR_HOST`, `FIRESTORE_EMULATOR_HOST`, and `FIREBASE_STORAGE_EMULATOR_HOST` as `host:port`, without an `http://` prefix.
