# Live cloud setup progress

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
