# Cloud setup and deployment

This is a runbook, not a deployment record. No credentials, cloud resources, live model response, Google-generated MP4, or deployed URL are supplied by the repository. The app implements auth/projects, a saved canvas, private image upload/copy/delete, integrated scene analysis and editable shot plans, plus separate server-side AI smoke commands. Queue-backed generation and conversational edits, the private worker, immutable MP4 versions, comparison/selection, saved timeline preview and original MP4 download are implemented. Real model access and cloud deployment remain unverified. Track executed checks and blockers in `TODO.md`. For credential-free development now, use [local Firebase emulators](local-emulators.md).

## Required accounts, credentials, and configuration

| Item | Where to obtain it | Where it belongs |
| --- | --- | --- |
| Google Cloud project with billing enabled | Cloud Console; add Firebase to this same project | `GOOGLE_CLOUD_PROJECT` on the API; project selected in Firebase CLI |
| Firebase web app configuration | Firebase Console > Project settings > Your apps > Web app | `apps/web/.env.local`: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` |
| Google / anonymous sign-in providers | Firebase Console > Authentication > Sign-in method | Console configuration; the browser obtains a Firebase ID token |
| Local Application Default Credentials (ADC) | `gcloud auth application-default login` | Local gcloud credential store; never commit it |
| Gemini API key and model entitlement | Google AI Studio, using the intended billing project | Local `apps/api/.env`; production Secret Manager binding to `GEMINI_API_KEY` |
| Analysis and video model IDs | Current official model documentation and account access | `GEMINI_ANALYSIS_MODEL`, `GEMINI_VIDEO_MODEL`; see [model verification and smoke tests](model-verification.md) |
| Private media bucket name | Cloud Storage setup below | `GCS_BUCKET` on API and worker |
| API runtime service account | IAM setup below | Cloud Run service identity, with resource-scoped grants |
| Deployer login | `gcloud auth login`, `firebase login` | Local CLI credential stores, separate from ADC |
| Container registry authorization | `gcloud auth configure-docker` | Local Docker credential helper |
| Tasks invoker and worker service accounts | Worker setup below | Server configuration only; no browser credentials |

Firebase web configuration is public application identification. The Gemini key and service-account private keys are secrets. Do not put them in `VITE_*`, frontend code, a Docker build argument, a command-line key literal, a commit, a screenshot, or a test report. Cloud Run uses its attached service identity; a downloaded service-account JSON key is unnecessary. [Firebase web configuration](https://firebase.google.com/docs/projects/api-keys), [Cloud Run service identity](https://docs.cloud.google.com/run/docs/securing/service-identity).

The Gemini API and Google Cloud deployment use distinct authentication paths: an API key with model access for Gemini, and ADC/IAM for Firestore, Storage, and Cloud Run. A successful cloud login does not prove access to a paid video model. Check current [Gemini billing](https://ai.google.dev/gemini-api/docs/billing) and pricing in AI Studio; do not assume free-tier access or entitlement from a model ID.

## 1. Install tools and select the project

Install Node.js 24, Git, [Google Cloud CLI](https://docs.cloud.google.com/sdk/docs/install), and Docker Desktop with Linux containers. `npm ci` installs the pinned local [Firebase CLI](https://firebase.google.com/docs/cli); invoke it with `npx.cmd firebase`. Commands below run in PowerShell from the repository root. Substitute the project ID and globally unique bucket name before running; these commands create billable infrastructure.

```powershell
$projectId = "YOUR_PROJECT_ID"
$region = "us-central1"
$bucketName = "YOUR_GLOBALLY_UNIQUE_PRIVATE_BUCKET"
$runtimeAccount = "aniforge-api@$projectId.iam.gserviceaccount.com"
$registryHost = "$region-docker.pkg.dev"

gcloud auth login
gcloud config set project $projectId
npx.cmd firebase login
gcloud services enable run.googleapis.com artifactregistry.googleapis.com firestore.googleapis.com storage.googleapis.com secretmanager.googleapis.com iamcredentials.googleapis.com identitytoolkit.googleapis.com firebase.googleapis.com generativelanguage.googleapis.com
```

In Cloud Console, link a billing account and configure a budget with alerts. Budgets notify; they do not automatically cap spend. In Firebase Console, add Firebase to the selected project and verify the billing plan required by the services in use. Choose compatible data locations deliberately; the region above is an example. Initial setup needs permissions to enable APIs, create resources/service accounts, and grant IAM. Ask the project administrator to perform setup if these permissions are unavailable; do not give the runtime account Owner or Editor.

## 2. Configure Firebase Auth and Firestore

1. Register a Firebase **Web app** and copy its public configuration to `apps/web/.env.local` using the example in the repository.
2. Enable **Google** sign-in, select the support email, and enable **Anonymous** for the demo entry point. Also set `VITE_ENABLE_ANONYMOUS_AUTH=true` in the frontend environment to show the guest button; its safe default is false. Anonymous accounts still have individual Firebase UIDs and owner-isolated projects. Clearing browser data or signing out can lose access to an unlinked anonymous account; use Google for work that must be retained.
3. In Authentication > Settings > Authorized domains, add the actual Hosting domain and any custom domain. For local development explicitly add `localhost` in the development project; new projects may omit it by default. [Firebase Google sign-in](https://firebase.google.com/docs/auth/web/google-signin), [authorized domain behavior](https://firebase.google.com/docs/auth/faq-and-troubleshooting).
4. Create a Cloud Firestore database in **Native mode**, database ID **`(default)`**, with the intended location and production rules. The API uses that default database.
5. Deploy the repository's deny-all browser rules and the asset/job collection-group and scene job/version indexes:

```powershell
npx.cmd firebase deploy --only firestore:rules,firestore:indexes --project $projectId
```

All data access goes through the API. Firebase Admin bypasses Firestore rules and is governed by IAM, so every API route must verify the Firebase token and enforce project ownership. The provided rules are defense against direct browser SDK access, not a replacement for server authorization. [Firestore server access and rules](https://firebase.google.com/docs/firestore/security/overview).

## 3. Create private storage and a runtime identity

```powershell
gcloud iam service-accounts create aniforge-api --display-name "AniForge API runtime"
gcloud projects add-iam-policy-binding $projectId --member "serviceAccount:$runtimeAccount" --role roles/datastore.user
gcloud projects add-iam-policy-binding $projectId --member "serviceAccount:$runtimeAccount" --role roles/firebaseauth.viewer
gcloud storage buckets create "gs://$bucketName" --project $projectId --location $region --uniform-bucket-level-access --public-access-prevention
```

The API calls `verifyIdToken(token, true)` to reject revoked sessions and disabled users. That extra check reads the Auth user record and needs `firebaseauth.users.get`; the predefined Firebase Authentication Viewer role supplies it. It does not grant user creation, deletion, or other Auth mutations. A project administrator can substitute a narrower custom role. [Session revocation checks](https://firebase.google.com/docs/auth/admin/manage-sessions), [Firebase Auth IAM roles](https://docs.cloud.google.com/iam/docs/roles-permissions/firebaseauth).

Private image uploads, reads, project copies and cleanup need object operations on this dedicated bucket. Set `GCS_BUCKET` on the API and grant this bucket-scoped role:

```powershell
gcloud storage buckets add-iam-policy-binding "gs://$bucketName" --member "serviceAccount:$runtimeAccount" --role roles/storage.objectUser
```

Do not grant `allUsers` or `allAuthenticatedUsers` bucket access. Uniform bucket-level access removes object ACLs; public access prevention blocks accidental public grants. The Object User role provides object read/write/delete operations without bucket administration. [Storage IAM roles](https://docs.cloud.google.com/storage/docs/access-control/iam-roles), [bucket creation](https://docs.cloud.google.com/storage/docs/creating-buckets), [public access prevention](https://docs.cloud.google.com/storage/docs/public-access-prevention).

`storage.rules` denies Firebase Storage browser access. It does **not** govern server GCS calls or arbitrary GCS buckets. If using a Firebase-managed default bucket, initialize Storage in Firebase Console, inspect the selected bucket, and deploy `firebase deploy --only storage --project $projectId`. For the dedicated GCS bucket created above, IAM and public access prevention are the controls; deploying Firebase rules does not secure it by itself.

For a future signed-URL implementation, object access and signing are separate permissions. An identity creating V4 URLs needs `iam.serviceAccounts.signBlob` on the signing service account, commonly via `roles/iam.serviceAccountTokenCreator` scoped to that account. Do not grant Token Creator broadly on the project. The signer also needs the corresponding object read/write permission. Grant signing only when that feature is implemented, keep URLs short lived and object specific, and authorize ownership before issuing each URL. An API proxy can avoid signing permissions. [Signed-URL prerequisites](https://docs.cloud.google.com/storage/docs/access-control/signing-urls-with-helpers).

The implemented image/video proxies and MP4 export send bytes through the API, so no browser bucket CORS or URL-signing permission is needed. If direct browser PUT/GET requests to signed URLs are added later, configure bucket CORS for the exact origins, methods and headers. CORS is a browser policy, not authorization.

## 4. Enable and prove real Gemini access

In [Google AI Studio](https://aistudio.google.com/), select the intended project, complete the applicable paid billing setup, and create a server API key. Apply compatible API restrictions for the Generative Language API. Verify that the account has access to the exact analysis/video models in the current official documentation. A 403 or model-not-found response is a blocker; never substitute a fabricated result.

Copy `apps/api/.env.example` to `apps/api/.env` and set `GEMINI_API_KEY`, model IDs, and `ENABLE_REAL_AI=true`. The verified defaults are `GEMINI_ANALYSIS_MODEL=gemini-3.8-flash` and `GEMINI_VIDEO_MODEL=gemini-omni-1.1-flash`; the Omni model requires paid access. Follow [model verification and smoke tests](model-verification.md) for the dated official evidence, original-image affirmation, commands, safe errors, and actual output evidence. Run analysis and video separately; a valid analysis result does not establish video access. Live requests may be billed. CI only uses declared test fixtures and never invokes a paid model.

Create the production secret in **Secret Manager > Create secret**, name it `aniforge-gemini-api-key`, and paste the key into the secret value field. Record its numeric version (initially `1`). This avoids placing the value in shell history. Then grant the runtime account access to this secret alone:

```powershell
gcloud secrets add-iam-policy-binding aniforge-gemini-api-key --member "serviceAccount:$runtimeAccount" --role roles/secretmanager.secretAccessor
```

The Cloud Run deployment below binds a numbered secret version. Rotate by creating a new version and deploying a revision with that version; do not silently change a running revision's intended key. Secret access is checked for the runtime service identity. [Cloud Run secret configuration](https://docs.cloud.google.com/run/docs/configuring/services/secrets).

### Enable integrated scene analysis when ready

Phase 3 needs the Firebase/Auth/Firestore/private-bucket setup above plus the Gemini server key. Set `ENABLE_REAL_AI=true`, `GEMINI_ANALYSIS_MODEL=gemini-3.8-flash`, `ANALYSIS_TIMEOUT_MS=40000`, and `MAX_ANALYSES_PER_USER_PER_DAY=20` in the API environment. The analysis deadline accepts 1,000–45,000 milliseconds; it is separate from the longer `AI_TIMEOUT_MS` used by CLI video smoke tests. Analysis does not require video-model entitlement or valid video configuration. Choose a lower daily attempt limit if preferred; accepted values are 1–100.

On the configured cloud service, after key binding and model access checks:

```powershell
gcloud run services update aniforge-api --region $region --update-env-vars "ENABLE_REAL_AI=true,GEMINI_ANALYSIS_MODEL=gemini-3.8-flash,ANALYSIS_TIMEOUT_MS=40000,MAX_ANALYSES_PER_USER_PER_DAY=20"
```

Sign in, open a saved original scene, enter notes, affirm content rights and possible API charges, and choose **Analyze scene**. Review the returned suggestion before applying it, edit the shot plan/prompt and save/reload. Record the real model, timestamp and validated result as live evidence. An enabled status indicator only means configuration was accepted; failed entitlement, malformed output, quotas and timeouts remain visible failures.

The API runtime's existing Firestore role covers new server-only `projects/{projectId}/analyses/{analysisId}` and `analysisUsage/{hashedUid}` records. Existing deny-all client rules also protect these paths; no new analysis index is required. The daily limit counts reserved attempts, including failures, and a 90-second reservation limits concurrent requests per user across instances. A five-second preflight limit prevents a slow database/storage read from initiating a late provider request. These controls are not a provider billing cap and anonymous accounts remain individual users; set appropriate provider/project quotas and review billing separately.

Analysis IDs are retained to prevent duplicate dispatch after retries or crashes. Ambiguous outcomes require checking Google activity before starting another request, since an aborted connection may still incur a charge. Snapshots and analysis records are private project content and are purged on project deletion; per-user daily usage records remain outside projects so deletion cannot reset the allowance. The standard emulator launcher forces real AI off even if a personal `.env` exists. Use the normal configured API workflow for an intentional real call; no secrets or paid requests are needed for manual shot plans.

## 5. Run the project API locally

```powershell
gcloud auth application-default login
gcloud auth application-default set-quota-project $projectId
npm ci
npm run dev
```

The ADC user needs Firestore access, Firebase Auth user-read permission for revocation checks, bucket object access for media, and permission to use the development quota project. Set `GOOGLE_CLOUD_PROJECT` in `apps/api/.env` to the same project as the frontend Firebase configuration, and `GCS_BUCKET` to the private bucket. Set `VITE_API_BASE_URL=http://localhost:8080/api/v1` and `ALLOWED_ORIGINS=http://localhost:5173`. A cloud service-account impersonation workflow is also possible if approved by the administrator; a private key file is not required. These cloud steps can wait while using the isolated local emulator launcher.

Without Firebase configuration, the UI explains what is missing. Without the backend project configuration, local `/health` remains available and project routes fail explicitly rather than using fake persistence. Production startup requires a project ID. A healthy process does not prove Firestore credentials or Gemini access; sign in and create/read a project to verify integration.

Run the complete local quality gate before deployment:

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:emulators
```

## 6. Build and deploy the API container

This runbook builds the Dockerfile from the **repository root**, including `packages/shared` and the root lockfile. Do not run a standalone `apps/api` source deploy: it omits the shared workspace. The deployer needs Artifact Registry write access on the repository, Cloud Run deployment permissions, and Service Account User (`iam.serviceAccounts.actAs`) on the runtime account. Grant public invocation through an administrator if the deployer cannot change service IAM. Cloud Run's service agent must be able to read the image; same-project Artifact Registry is the intended setup. [Container deployment permissions](https://docs.cloud.google.com/run/docs/deploying).

```powershell
gcloud artifacts repositories create aniforge --repository-format docker --location $region --description "AniForge application containers"
gcloud auth configure-docker $registryHost
$imageTag = git rev-parse --short HEAD
$imageName = "$registryHost/$projectId/aniforge/api:$imageTag"
docker build --platform linux/amd64 --file apps/api/Dockerfile --tag $imageName .
docker push $imageName

gcloud run deploy aniforge-api --image $imageName --region $region --service-account $runtimeAccount --allow-unauthenticated --port 8080 --memory 1Gi --cpu 1 --concurrency 2 --min 0 --max 3 --timeout 60 --set-env-vars "NODE_ENV=production,GOOGLE_CLOUD_PROJECT=$projectId,GCS_BUCKET=$bucketName,ENABLE_REAL_AI=false,ALLOWED_ORIGINS=https://$projectId.web.app" --set-secrets "GEMINI_API_KEY=aniforge-gemini-api-key:1"
$apiUrl = gcloud run services describe aniforge-api --region $region --format "value(status.url)"
Invoke-RestMethod "$apiUrl/health"
```

Use a unique immutable image tag for each reviewed revision. If there is no commit yet, set an explicit unique release tag. Keep `ENABLE_REAL_AI=false` for initial deployment, then follow the explicit analysis enablement steps above. The queue-backed video endpoint remains disabled until the private worker setup in section 8 is complete. Binding a key does not activate generation by itself.

Image decoding consumes more memory than compressed file size. The example deliberately starts with low request concurrency and 1 GiB memory; validate peak memory under representative 16-megapixel uploads before raising concurrency. These are conservative starting settings, not a completed capacity test.

Cloud Run allows public **network invocation** so browsers can reach the API, but project/scene requests still require a Firebase ID token and server ownership checks. The public health endpoint contains no credentials. Configure `ALLOWED_ORIGINS` with every actual frontend origin (comma separated); if changing it with gcloud, use an env YAML file or a custom `--set-env-vars` delimiter so commas inside its value are preserved. CORS does not replace token verification.

The Dockerfile runs as an unprivileged user and contains compiled API/shared code with production dependencies. Docker context ignores local secrets and artifacts. Docker build and cloud deployment must be verified in an environment with Docker/Cloud CLI access; repository builds alone do not establish container or cloud success. Optional Cloud Build automation requires enabling `cloudbuild.googleapis.com` and configuring a build identity; the command sequence above uses local Docker and does not depend on Cloud Build.

## 7. Build and deploy Hosting

Set the production Firebase web configuration and `VITE_API_BASE_URL` to the Cloud Run URL plus `/api/v1` in `apps/web/.env.production.local`. These Vite values are baked into the bundle and require a rebuild after changes. Keep the API's origin allowlist and Auth authorized domains synchronized with the published site.

```powershell
npm run build
npx.cmd firebase deploy --only hosting,firestore:rules,firestore:indexes --project $projectId
```

`firebase.json` already points to `apps/web/dist`, sets an SPA fallback, and configures static cache/security headers. No Hosting initialization is needed. `.firebaserc.example` is an optional project alias template; the explicit `--project` flags avoid relying on an implicit target. The frontend calls Cloud Run directly; no synchronous video-generation Hosting rewrite is configured. [Hosting configuration](https://firebase.google.com/docs/hosting/full-config).

Verify Google and anonymous sign-in, create/rename/duplicate/delete, import/crop/save/refresh, sign out, and confirm a second user cannot access the first user's project or image. Confirm a copied image remains after deleting the original project. Test a deep link such as `/studio/PROJECT_ID` after refresh, the browser CORS console, and 401 without a token. Record the actual site/API URLs and date in the milestone report. Do not mark media or generation gates complete from a successful Hosting deploy.

## 7a. Schedule private-media recovery before production use

The API retries interrupted uploads, copies and deletes at startup and every five minutes while running. A Cloud Run service using request-based CPU allocation cannot guarantee timer execution while idle. Configure a scheduled recovery job for production; this is separate from the AI video worker. [Cloud Run CPU allocation](https://docs.cloud.google.com/run/docs/configuring/billing-settings).

For an operator with ADC and the configured API environment, `npm run build` followed by `npm run cleanup:assets` performs one finite recovery pass. It returns nonzero on failure and retains cleanup records for retry. For Cloud Run, reuse the built API image and runtime account from step 6, without a Gemini secret:

```powershell
gcloud run jobs create aniforge-media-cleanup --image $imageName --region $region --service-account $runtimeAccount --command node --args /app/apps/api/dist/cleanup.js --tasks 1 --parallelism 1 --max-retries 2 --task-timeout 300s --memory 512Mi --set-env-vars "NODE_ENV=production,GOOGLE_CLOUD_PROJECT=$projectId,GCS_BUCKET=$bucketName,ENABLE_REAL_AI=false"
gcloud run jobs execute aniforge-media-cleanup --region $region --wait
```

Inspect the execution logs for `status: completed` and verify bucket/Firestore recovery on a disposable test project. The deployer needs Cloud Run job create/execute permissions, image access and permission to attach the runtime identity. [Creating Cloud Run jobs](https://docs.cloud.google.com/run/docs/create-jobs).

Create a dedicated Scheduler identity and grant invocation only on this cleanup job. The administrator needs Scheduler creation and service-account attachment permissions:

```powershell
gcloud services enable cloudscheduler.googleapis.com
gcloud iam service-accounts create aniforge-cleanup-scheduler --display-name "AniForge cleanup schedule"
$schedulerAccount = "aniforge-cleanup-scheduler@$projectId.iam.gserviceaccount.com"
gcloud run jobs add-iam-policy-binding aniforge-media-cleanup --region $region --member "serviceAccount:$schedulerAccount" --role roles/run.invoker
gcloud scheduler jobs create http aniforge-media-cleanup --location $region --schedule "*/30 * * * *" --time-zone UTC --uri "https://run.googleapis.com/v2/projects/$projectId/locations/$region/jobs/aniforge-media-cleanup:run" --http-method POST --oauth-service-account-email $schedulerAccount
```

This targets the authenticated Google Run API with OAuth; it does not expose a cleanup HTTP route on the app. Confirm a scheduled execution succeeds, monitor failed executions, and update the job image when deploying cleanup changes. Keep the Google-managed Scheduler service agent's required role. [Scheduling Cloud Run jobs](https://docs.cloud.google.com/run/docs/execute/jobs-on-schedule).

Pending uploads/copies become eligible for recovery after one hour; explicit cleanup/delete records are retryable immediately. Removed canvas images remain private in their project until project deletion, so undo and saved references can still resolve. Duplication copies only images currently referenced by scenes. A deleted project retains only `{id, ownerId, lifecycle, deletedAt}` indefinitely, allowing repeated sweeps to remove late writes; titles, scenes, asset metadata and media are purged. The current sweep reads all outstanding records/tombstones: retention compaction and batched scheduling are needed before large-scale usage. No production recovery job or schedule has been deployed or verified yet.

## 8. Deploy the private video worker and recovery schedule

The worker handles initial generation and Phase 5 edits on the same queue. Follow [the complete video worker runbook](video-worker-setup.md) for queue limits, dedicated service accounts, OIDC, worker deployment, scheduled outbox recovery, paid enablement and live generation/edit verification. `WORKER_URL` is the exact service origin, without the handler path. These cloud steps have not been executed in this environment.

### Phase 5 credentials and deployment changes

No new credential, IAM grant, queue, database migration or Firestore index is required beyond the preceding setup and the worker runbook. Deploy updated API, worker, frontend, recovery and cleanup images/builds. For an existing Phase 4 installation, use the runbook's coordinated update: stop new video submissions, pause/drain the queue, update the worker before the API/UI can submit edit jobs, then resume. The old worker treats jobs as initial generation and must not receive new edit jobs.

Conversational edits reuse the worker's paid Gemini key and the parent's stored interaction ID. An explicitly selected stored-video edit uses that same key for Google Files upload; it does not require public bucket access or an additional browser credential. It uploads the actual saved parent MP4 and starts a new paid conversation. Both paths share `ENABLE_VIDEO_GENERATION`, `ENABLE_REAL_AI` on the worker, `AI_TIMEOUT_MS`, and `MAX_VIDEOS_PER_USER_PER_DAY`; failed accepted attempts consume the same allowance as initial generation.

Confirm that the account supports the chosen edit path. Uploaded-video editing currently excludes the EEA, Switzerland and UK and accepts inputs at most 10 seconds. The provider rejects unknown/invalid/longer movie-header durations before upload. A local preview trim does not alter the uploaded file. Retained interactions can expire, and an expired edit never silently triggers another paid upload. [Model verification](model-verification.md) records current official limits, safe errors and temporary-upload cleanup/expiry behavior.

Selection, comparison, timeline metadata and original MP4 export need only the existing Firebase/Firestore/private-bucket access. They make no AI call. Verify a saved selection survives refresh, both parent and edited clips remain playable, second-user requests fail, and the exported bytes match the selected stored version. Preview captions and trim remain editable metadata; the MP4 download does not render them. Real initial generation and a distinct real follow-up edit remain separate acceptance gates from fixture/emulator success.

## Evidence and remaining manual steps

The machine used for implementation has no supplied cloud credentials or configured Gemini key. Phase 2 installed a pinned local Firebase CLI and ran actual Auth/Firestore/Storage emulators using the existing Android Studio Java runtime. Local browser persistence, ownership and media recovery passed; production IAM, billing, real MP4 output and deployment remain unverified. Required external work remains: gcloud/Docker installation, project/billing selection, Auth providers and authorized domains, Firestore creation/index deployment, ADC, private bucket/IAM, Gemini entitlement and secret, container push, Cloud Run API/cleanup-job deployment, Scheduler, Hosting, and live integration verification. Keep results for each gate separate in `TODO.md`.
