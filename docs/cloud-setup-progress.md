# Live cloud setup progress

## October 15, 2026 video activation

**Analysis and video generation are enabled.** The owner confirmed live analysis worked and applied its suggestion. One real Gemini Omni request produced a 4.01-second, 720p MP4; browser playback passed. The deployed worker recovered that existing provider file into private GCS with exact-byte verification and published one immutable version. Anonymous media access was denied, and duplicate completed-job delivery did not regenerate. This was a real provider smoke plus real cloud recovery/storage verification; the owner's fresh browser video-generation flow and conversational edit still need observation.

Current ready revisions: API `aniforge-api-00008-kxk`, private worker `aniforge-worker-00003-h7g`, each receiving 100% of its traffic. Cloud Tasks/OIDC and the five-minute video recovery schedule are configured and verified. The separate 30-minute media-cleanup schedule was blocked by automatic approval review because it can delete media; the owner explicitly chose to keep it deferred. No such deletion schedule was created.

All credential requirements, service-account grants, worker/queue settings, real output locations, tests and remaining checks are recorded in [video activation results](video-activation-results.md). Typecheck, lint, 208 unit tests, release build and the 32-file artifact scan passed for this setup. The following analysis/setup records are historical checkpoints.

## October 15 analysis checkpoint (before video activation)

**Real scene analysis is enabled on the deployed API.** Replacement-key smoke testing with `gemini-3.8-flash` passed, validated Google's shot plan and saved the real output; see [model verification](model-verification.md). Fixed stateless analysis responses without an interaction ID and added actionable HTTP 402 handling. Video generation remains disabled and unverified.

The owner's later request `req-1h` exposed a missed application-service check that still rejected null IDs despite the provider fix. An API regression reproduced HTTP 502 before correction. The follow-up deployment below fixes that second check; no new paid request was made. The browser emulator test now verifies stateless analysis through Firestore persistence, review/apply, save and reload.

### Credentials and cloud steps completed

- The owner refreshed `gcloud auth login`. The deployment uses that interactive account; no downloaded service-account key is needed.
- The replacement Gemini key remains in ignored `apps/api/.env`. The owner reports the separate AI billing account has prepaid funds. The infrastructure project stays `aniforge-511502`; Firebase configuration and media storage were preserved.
- Enabled `secretmanager.googleapis.com` in `aniforge-511502`, created `aniforge-gemini-api-key`, and uploaded version `1` via stdin without displaying its contents. Read-back verified an exact match to the local key. The upload process reported failure after the version was created; independent read-back verified success before proceeding.
- Granted `roles/secretmanager.secretAccessor` on that secret to `aniforge-api@aniforge-511502.iam.gserviceaccount.com`. Cloud Run binds `GEMINI_API_KEY` to numbered version `1`; the key is not a browser environment variable.
- Checked the actual 302-file Cloud Build upload manifest: local environment files, history and artifacts excluded, and the configured key absent from included file contents.
- Initial activation used Cloud Build `fd04c2fc-8edb-4f1c-8440-1200f785839c` and revision `aniforge-api-00006-ldz`. Follow-up Cloud Build `21bfef9f-b532-4e5f-9ba3-e74b38f7294d` completed `SUCCESS`, after rechecking the 302-file upload for secrets. Current image: `us-central1-docker.pkg.dev/aniforge-511502/aniforge/api@sha256:dfbe73fe79ea16251461bb33e98756c748702c18122cae6162a9c80d26bbecda`.
- Current revision `aniforge-api-00007-s9p` is ready and receives 100% of traffic. The update changed only the image. Read-back confirms the same numbered secret binding, `ENABLE_REAL_AI=true`, and `ENABLE_VIDEO_GENERATION=false`. Configured analysis model/deadline/daily limit remain `gemini-3.8-flash`, 40000 ms and 20; local analysis opt-in is also enabled.

### Verification and remaining gates

After the follow-up correction, typecheck, lint, all **208 unit tests in 15 files**, all **40 browser/integration emulator tests**, and the release build passed. The 32-file browser artifact scan passed; existing Zod annotation and emulator dependency warnings remain non-blocking. No frontend deployment was needed.

On the corrected revision, live `/health` returned HTTP 200 with Firebase configured; unauthenticated `/api/v1/projects` returned 401. OPTIONS returned 204 with `access-control-allow-origin: https://aniforge.shivafj.dev`. These checks establish service readiness and CORS, not authenticated live analysis persistence. Next, refresh the custom domain, open a project with an original saved scene, click **Analyze scene**, and confirm the returned plan can be reviewed and saved. **Retry same analysis** intentionally retrieves the previously stored failure; it does not dispatch a replacement paid call. Prior failed records and the owner's drawing/plan were not modified.

Video still requires the private Cloud Run worker, Cloud Tasks queue, task OIDC identity/invoker permissions and recovery scheduler described in [the worker runbook](video-worker-setup.md), followed by real generation/edit and playback checks. No MP4, video entitlement or remaining billing balance is claimed from the analysis success. Earlier records below are historical checkpoints and are superseded by this update.

Recorded October 13, 2026 for `aniforge-511502`. This is a partial setup record, not a deployed-app or live-AI success report.

## Verified

- Firebase CLI can access the active project. Registered `AniForge Web` and retrieved its public SDK configuration into Git-ignored `apps/web/.env.local`.
- Backend project ID is set in Git-ignored `apps/api/.env`. Real AI and video generation remain disabled; no Gemini key was supplied.
- Google Cloud CLI is installed. The owner completed interactive CLI and Application Default Credentials login and selected this quota project. Credentials remain in the local gcloud store, outside the repository; no service-account key was downloaded.
- ADC-backed Firestore database and Firebase Authentication configuration reads returned HTTP 200.
- Firestore `(default)` is Standard edition, Native mode, location `nam5` (US multi-region).
- Google sign-in provider reports `enabled: true`. Authorized domains include `localhost`, `aniforge-511502.firebaseapp.com` and `aniforge-511502.web.app`.
- `firebase deploy --only firestore:rules,firestore:indexes --project aniforge-511502 --non-interactive` exited 0. Read-back confirmed the published deny-all browser rules match `firestore.rules`.
- Composite indexes for `jobs` and `videoVersions`, and field override indexes for `assets.state` and `jobs.status`, now report `READY`.

## Billing and private storage follow-up

The initial bucket creation failed because project billing was disabled. After the owner linked billing, an independent check returned `billingEnabled: true`. Created `gs://aniforge-511502-private-media` in `us-central1` and set `GCS_BUCKET` in the ignored backend environment file.

Read-back confirmed uniform bucket-level access, enforced public access prevention and no public IAM bindings. Real ADC Firestore document write/read and Storage object write/read passed with exact content checks. An anonymous HTTPS GET of the existing test object returned HTTP 403. The temporary document and object were deleted afterward (provider retention/soft-delete policies can retain deleted object bytes). These were SDK infrastructure checks, not proof of browser login, API ownership enforcement or a deployed application.

## Remaining work

### API deployed; Hosting prepared

The owner's Cloud Run deployment was independently verified ready at `https://aniforge-api-ramx6nybyq-uc.a.run.app`, revision `aniforge-api-00001-5d7`, using the recorded image digest and `aniforge-api` runtime identity. Both AI switches are false and no Gemini secret is bound.

Live health returns HTTP 200 with Firebase configured. Unauthenticated project requests return HTTP 401. Both standard Hosting origins receive their matching allow-origin header; an untrusted origin gets no allow-origin header (HTTP 401, not 403). These checks do not prove authenticated persistence or media operations under the deployed runtime identity.

Prepared ignored `apps/web/.env.release.local` with the existing public Firebase configuration and deployed API URL. Updated public canonical/social URLs for `https://aniforge-511502.web.app`. Fresh typecheck, lint and all 200 unit tests (15 files) passed; `npm run build:release` and the 19-file artifact scan passed. Existing Zod annotation warnings remain non-blocking. Browser/emulator suites were not rerun for this environment/metadata change. Hosting publication and live browser checks remain pending.

### Build preparation verified

- API runtime identity has `roles/datastore.user`, `roles/firebaseauth.viewer` and bucket-scoped `roles/storage.objectUser` on the media bucket.
- Artifact Registry Docker repository `aniforge` exists in `us-central1`. The separate `aniforge-build` identity has repository-scoped Artifact Registry Writer, project Logs Writer and Object Viewer on the private `aniforge-511502-aniforge-build-source` bucket.
- The source bucket has uniform bucket-level access and enforced public access prevention.
- Pre-upload inspection found local editor backups under `.history/apps/api/.env_*`. Added `.history` and `.env_*` exclusions to Git, Cloud Build and Docker ignore files. Rechecked the actual 260-file Cloud Build upload manifest: no flagged local/secret paths and no occurrence of the currently configured Gemini key. This is a bounded check, not a guarantee against every possible secret. Nothing was uploaded during this inspection.
- Cloud Build `a6c96f63-0d0b-4ea7-9ef0-375bc09d29f2` was submitted by the owner and independently verified as `SUCCESS`. Image: `us-central1-docker.pkg.dev/aniforge-511502/aniforge/api@sha256:0528e73552cad35e79100b3376a07cf1e24bd65843b129f322de9843e9c3a234`. This verifies a built/pushed container, not Cloud Run deployment or container runtime behavior. No application source changed in this preparation step; ignore behavior and `git diff --check` were checked directly.

Local `npm run dev` startup passed after the bucket was configured. API health reports Firebase configured (HTTP 200), the frontend `/projects` route returns HTTP 200, and unauthenticated `/api/v1/projects` returns HTTP 401. The user should open `http://localhost:5173/projects` for Google sign-in because `localhost` is an authorized Auth domain. Browser sign-in and save/reload have not yet been observed.

- Verify actual browser Google sign-in, owner-isolated project persistence and private media upload/read through the local backend.
- Publish Hosting, verify authenticated Cloud Run access and configure scheduled media recovery. The private video worker/queue and its identity checks remain deferred with AI, as described in [cloud setup](cloud-setup.md).
- Obtain separately configured Gemini API paid access and a server-only key before any explicitly authorized real model smoke tests.
- Run the [release checklist](release-checklist.md); the API is deployed, but no frontend publication or end-to-end production success is claimed yet.

These checks used real Google control-plane APIs, not emulator fixtures. No application source changed, so local typecheck/lint/unit/build suites were not rerun for this configuration checkpoint. Existing Windows Firebase CLI exit assertions have occurred after successful responses; operations are verified by response/read-back rather than assuming every failed process exit means the cloud operation failed.
