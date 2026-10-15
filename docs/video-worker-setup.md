# Private video generation and edit worker setup

These are repeatable operator instructions, not themselves proof of deployment. The October 15 execution, credentials, real MP4, private storage checks and explicit media-cleanup deferral are recorded in [video activation results](video-activation-results.md). Complete the project, billing, Firebase Auth, private bucket, Gemini secret and container steps in [cloud setup](cloud-setup.md) first. Reuse its PowerShell variables `$projectId`, `$region`, `$bucketName`, `$imageName`, `$runtimeAccount` and `$schedulerAccount`. No service-account JSON key is required. The API and recovery process use ADC; only the worker needs the Gemini key for video.

Phase 5 adds conversational edits and explicit stored-video upload edits to this same queue and worker. It requires no additional secret, service account, queue, IAM role or Firestore index. Selection, comparison, timeline saves and original MP4 downloads use the existing authenticated API and bucket permissions. Only new AI edits require paid access. For an existing Phase 4 deployment, use the coordinated image update below before enabling the new UI.

## Accounts and queue

The deployer needs permissions to enable services, create service accounts/queues/Run resources/Scheduler jobs, set these IAM grants, access the image and attach each runtime identity. An administrator must supply missing grants. Do not assign Owner/Editor to runtime accounts.

```powershell
gcloud services enable cloudtasks.googleapis.com cloudscheduler.googleapis.com iamcredentials.googleapis.com
gcloud iam service-accounts create aniforge-worker --display-name "AniForge video worker"
gcloud iam service-accounts create aniforge-tasks-invoker --display-name "AniForge task invocation"
gcloud iam service-accounts create aniforge-video-recovery --display-name "AniForge video outbox recovery"
$workerAccount = "aniforge-worker@$projectId.iam.gserviceaccount.com"
$tasksAccount = "aniforge-tasks-invoker@$projectId.iam.gserviceaccount.com"
$recoveryAccount = "aniforge-video-recovery@$projectId.iam.gserviceaccount.com"
$queueName = "aniforge-generation"
gcloud tasks queues create $queueName --location $region --max-dispatches-per-second 1 --max-concurrent-dispatches 2 --max-attempts 20 --max-retry-duration 1800s --min-backoff 30s --max-backoff 120s
gcloud projects add-iam-policy-binding $projectId --member "serviceAccount:$workerAccount" --role roles/datastore.user
gcloud storage buckets add-iam-policy-binding "gs://$bucketName" --member "serviceAccount:$workerAccount" --role roles/storage.objectUser
gcloud secrets add-iam-policy-binding aniforge-gemini-api-key --member "serviceAccount:$workerAccount" --role roles/secretmanager.secretAccessor
gcloud projects add-iam-policy-binding $projectId --member "serviceAccount:$recoveryAccount" --role roles/datastore.user
foreach ($enqueuer in @($runtimeAccount, $recoveryAccount)) {
  gcloud tasks queues add-iam-policy-binding $queueName --location $region --member "serviceAccount:$enqueuer" --role roles/cloudtasks.enqueuer
  gcloud iam service-accounts add-iam-policy-binding $tasksAccount --member "serviceAccount:$enqueuer" --role roles/iam.serviceAccountUser
}
npx.cmd firebase deploy --only firestore:rules,firestore:indexes --project $projectId
```

Wait until indexes are ready. `firestore.indexes.json` includes scene job/version ordering and collection-group job status recovery. Preserve the Google-managed Cloud Tasks service agent's `roles/cloudtasks.serviceAgent` grant. If absent in an older project, an administrator must restore it to `service-PROJECT_NUMBER@gcp-sa-cloudtasks.iam.gserviceaccount.com`; do not grant that role to an application account. The Tasks invoker needs no Firestore, Storage or secret permissions. [Authenticated task requirements](https://docs.cloud.google.com/tasks/docs/creating-http-target-tasks).

## Deploy the private service

For the first deployment, briefly run the existing API entry point privately with AI disabled to obtain this service's canonical URL. No task is pointed at it yet. Then replace the entry point with the actual worker. For later deployments, reuse `$workerUrl` and deploy the worker entry point directly.

```powershell
gcloud run deploy aniforge-worker --image $imageName --region $region --service-account $workerAccount --no-allow-unauthenticated --command node --args /app/apps/api/dist/server.js --port 8080 --memory 1Gi --cpu 1 --concurrency 1 --min 0 --max 2 --timeout 450 --set-env-vars "NODE_ENV=production,GOOGLE_CLOUD_PROJECT=$projectId,GCS_BUCKET=$bucketName,ENABLE_REAL_AI=false,ENABLE_VIDEO_GENERATION=false"
$workerUrl = gcloud run services describe aniforge-worker --region $region --format "value(status.url)"
gcloud run services update aniforge-worker --region $region --command node --args /app/apps/api/dist/worker.js --set-env-vars "NODE_ENV=production,GOOGLE_CLOUD_PROJECT=$projectId,GCS_BUCKET=$bucketName,ENABLE_VIDEO_GENERATION=true,ENABLE_REAL_AI=false,AI_TIMEOUT_MS=300000,CLOUD_TASKS_QUEUE=$queueName,CLOUD_TASKS_LOCATION=$region,WORKER_URL=$workerUrl,TASKS_SERVICE_ACCOUNT=$tasksAccount" --set-secrets "GEMINI_API_KEY=aniforge-gemini-api-key:1"
gcloud run services add-iam-policy-binding aniforge-worker --region $region --member "serviceAccount:$tasksAccount" --role roles/run.invoker
gcloud run services get-iam-policy aniforge-worker --region $region
```

Verify that neither `allUsers` nor `allAuthenticatedUsers` can invoke the worker and that no broader project-level invoker grant defeats this restriction. Keep Cloud Run's invoker IAM check enabled. The worker also verifies the Google-signed Authorization token's issuer, audience, verified email and exact Tasks identity; a Firebase user token or `X-CloudTasks-*` header is insufficient. **`WORKER_URL` is the exact HTTPS `.run.app` origin, without a trailing slash or handler path.** The queue adds `/internal/jobs/execute`; its OIDC audience is the origin. Use the normal `Authorization` header supplied by Cloud Tasks. Custom domains/audiences and `X-Serverless-Authorization` are not supported by this adapter. [Cloud Run task invocation](https://docs.cloud.google.com/run/docs/triggering/using-tasks), [service authentication](https://docs.cloud.google.com/run/docs/authenticating/service-to-service).

## Schedule durable queue recovery

A job is reserved in Firestore before task submission. If submission or its acknowledgement is lost, this finite job re-enqueues the same logical job safely. Schedule it before enabling generation. It also expires stale jobs; no in-process idle timer is required.

```powershell
gcloud run jobs create aniforge-video-recovery --image $imageName --region $region --service-account $recoveryAccount --command node --args /app/apps/api/dist/recover-videos.js --tasks 1 --parallelism 1 --max-retries 2 --task-timeout 300s --memory 512Mi --set-env-vars "NODE_ENV=production,GOOGLE_CLOUD_PROJECT=$projectId,ENABLE_VIDEO_GENERATION=true,CLOUD_TASKS_QUEUE=$queueName,CLOUD_TASKS_LOCATION=$region,WORKER_URL=$workerUrl,TASKS_SERVICE_ACCOUNT=$tasksAccount"
gcloud run jobs execute aniforge-video-recovery --region $region --wait
gcloud run jobs add-iam-policy-binding aniforge-video-recovery --region $region --member "serviceAccount:$schedulerAccount" --role roles/run.invoker
gcloud scheduler jobs create http aniforge-video-recovery --location $region --schedule "*/5 * * * *" --time-zone UTC --uri "https://run.googleapis.com/v2/projects/$projectId/locations/$region/jobs/aniforge-video-recovery:run" --http-method POST --oauth-service-account-email $schedulerAccount
```

`$schedulerAccount` is created in cloud setup section 7a. The recovery account has queue/Firestore access but no Gemini secret or bucket access. Keep the separate private-media cleanup schedule too: it sweeps deletion tombstones and late writes. Update both job images with every relevant deployment. Inspect executions for `Video outbox recovery completed.` and monitor failures. For an authorized local operator using the configured API `.env`, `npm run build` then `npm run recover:videos` runs the same finite pass. [Scheduling Run jobs](https://docs.cloud.google.com/run/docs/execute/jobs-on-schedule).

## Enable and verify real generation and edits

Only after confirming paid Gemini Omni access, budget/quota and the original image rights, enable the worker's paid calls and the API enqueue routes:

```powershell
gcloud run services update aniforge-worker --region $region --update-env-vars ENABLE_REAL_AI=true
gcloud run services update aniforge-api --region $region --update-env-vars "ENABLE_VIDEO_GENERATION=true,MAX_VIDEOS_PER_USER_PER_DAY=3,CLOUD_TASKS_QUEUE=$queueName,CLOUD_TASKS_LOCATION=$region,WORKER_URL=$workerUrl,TASKS_SERVICE_ACCOUNT=$tasksAccount"
```

The API's `ENABLE_REAL_AI` remains a separate switch for analysis. API video availability confirms configuration, not worker reachability or model entitlement. The worker uses `GEMINI_VIDEO_MODEL=gemini-omni-1.1-flash` by default, `GEMINI_API_KEY` from the paid project, and `AI_TIMEOUT_MS` capped at 300,000. These settings never belong in `VITE_*`. Both source-rights and paid-attempt checkboxes must be affirmed for each new job.

1. Run the real server [video smoke command](model-verification.md), manually play its MP4, and record model, interaction ID privately, bytes, elapsed time and observed charges. No supplied credentials means this step remains unverified.
2. Sign in, add original content, save a complete shot plan and click Generate animation. Confirm POST returns 202 and a queued job promptly; the browser must not wait on Google generation.
3. Observe queued/running/succeeded, verify the private GCS object's `video/mp4` type and stored version, play it, reload, and play again. Change the canvas during generation and confirm the result retains its submitted revision/plan.
4. Verify unsigned/wrong-identity worker requests and another Firebase user's job/version/content requests fail. Test redelivery of the **same** task/job and confirm no additional Google create call or version. Exercise a non-billable missing-job task to verify OIDC first.
5. Test a paused queue and recovery, a denied model request and stored failure, and a worker interruption. A dispatched job without a saved file reference becomes `GENERATION_OUTCOME_UNKNOWN` after its lease, not a new generation. Inspect AI Studio before explicitly submitting a new ID.

6. Select the genuine initial version, enter one edit instruction, affirm rights and charges, and choose **Create edited version** using the retained interaction. Verify the edit returns a queued job promptly, then a distinct version linked to its parent. Play both comparison players, check the actual requested change and confirm both MP4s remain available after reload. Record distinct provider IDs privately; public version/job responses must not expose them.
7. Save **Use this version**, then select and save the earlier version. Reload to verify the chosen pointer. Change trim/captions, save and reload, and confirm preview behavior. **Download original MP4** must return the exact selected stored clip, without preview trim or caption overlays; **Download timeline JSON** preserves the editable preview metadata separately.
8. Explicitly choose **Upload this stored MP4 as a new video source** for a real clip at most 10 seconds, when the account's region and entitlement support it. Confirm this creates a new conversation and immutable child version. A missing/expired prior interaction must first return a visible failure; it must not silently trigger an upload. Do not use a local preview trim to claim that a longer stored MP4 meets the upload limit.
9. Verify wrong-owner access fails for the edit, individual version metadata, selection and export endpoints. A failed edit or worker retry must retain the old playable MP4, prompt and selected version. Re-delivering an edit with its saved output-file checkpoint must perform only retrieval, without a second model create.

Record actual outputs and blockers in the current phase results; do not mark the real generation or follow-up-edit gates complete from the labeled local fixtures. To stop new submissions, set API `ENABLE_VIDEO_GENERATION=false`; already queued work needs the queue paused and worker `ENABLE_REAL_AI=false` too. Provider calls already accepted can still finish and charge.

## Update an existing deployment for Phase 5

Build and push the new immutable `$imageName` from the repository root using cloud setup section 6. Set `ENABLE_VIDEO_GENERATION=false` on the API, pause the queue and let active worker requests finish. Then update the private worker **before** the API/UI can enqueue edit jobs: a Phase 4 worker does not understand edit dispatch. Keep the existing service identities, secret binding, OIDC origin and queue configuration. The CLI supports updating the container image on existing [Run services](https://docs.cloud.google.com/sdk/gcloud/reference/run/services/update) and [Run jobs](https://docs.cloud.google.com/sdk/gcloud/reference/run/jobs/update).

```powershell
gcloud run services update aniforge-api --region $region --update-env-vars ENABLE_VIDEO_GENERATION=false
gcloud tasks queues pause $queueName --location $region
# After active worker requests have finished:
gcloud run services update aniforge-worker --region $region --image $imageName
gcloud run services update aniforge-api --region $region --image $imageName
gcloud run jobs update aniforge-video-recovery --region $region --image $imageName
gcloud run jobs update aniforge-media-cleanup --region $region --image $imageName
npm run build
npx.cmd firebase deploy --only hosting,firestore:rules,firestore:indexes --project $projectId
```

Verify that the worker serves only its private entry point, receives 100% of new traffic on the updated revision, and retains the exact Tasks invoker IAM restriction. Confirm the Firebase frontend and API use the same project and that the API video status remains disabled during checks. Queue [pause](https://docs.cloud.google.com/sdk/gcloud/reference/tasks/queues/pause) and [resume](https://docs.cloud.google.com/sdk/gcloud/reference/tasks/queues/resume) control task dispatch; they do not cancel a provider call already accepted. When ready to accept the same authorized paid workload:

```powershell
gcloud tasks queues resume $queueName --location $region
gcloud run services update aniforge-api --region $region --update-env-vars ENABLE_VIDEO_GENERATION=true
```

Old initial-job records and versions remain readable through schema defaults; no database migration is required. Existing queued initial jobs can resume on the new worker. Keep the updated worker when rolling back the API/UI while any edit job remains queued; routing such a job to the old worker is unsupported. These commands are an operator procedure, not evidence that deployment occurred.

## Operational limits

- One active generation or edit per user across instances; both share the default three accepted attempts per UTC day, including failures. These are per-user controls, **not a project-wide spending cap**. Anonymous users can create new identities. Limit demo access and enforce project quota/budget controls before a public paid launch.
- Worker lease: six minutes. Omni call and file download: at most five minutes per provider attempt; an upload edit includes input upload and processing in this same bound. Cloud Run timeout: 450 seconds. Cloud Tasks dispatch deadline: 600 seconds. A job expires after 30 minutes. Configure all consistently.
- The documented synchronous Omni interaction runs inside the worker with `store=true`, `delivery=uri`, 720p and 16:9. General Interactions background docs do not explicitly establish Omni support, so this adapter does not assume it. Real latency may exceed the current bound; live testing must establish suitability before release. [Omni format](https://ai.google.dev/gemini-api/docs/omni), [background execution scope](https://ai.google.dev/gemini-api/docs/background-execution).
- Only explicit provider 429 rejection is retried during create (at most twice within its deadline). After a completed Google file reference is durably checkpointed, a maximum of three total worker claims can recover file download/storage. An ambiguous create outcome never automatically regenerates.
- Up to 100 MiB per immutable MP4. The player fetches the authenticated whole file into a Blob and revokes its URL on change/unmount; streaming/range proxy is deferred. Validate representative memory/latency at this limit. MP4 header validation does not guarantee codecs or playability; browser errors are visible and live outputs need manual playback checks.
- Uploaded input MP4s must have a finite validated duration at most 10 seconds. Google currently does not offer uploaded-video editing in the EEA, Switzerland or UK, and voice editing is unsupported. The same server Gemini API key authorizes Files upload; a public GCS URL is unnecessary. See [current model limitations and retention](model-verification.md). Temporary uploaded inputs receive best-effort deletion after known completed interactions; ambiguous in-flight calls and interrupted cleanup may leave them until Google's 48-hour Files expiry.
- Latest 30 jobs/versions per scene are listed; a saved selection and its immediate parent can also be loaded individually for comparison. Old records/media remain private until project deletion. Uploaded snapshots and failed publication media remain with the project; project cleanup handles them. Source objects and prior versions are never overwritten. Timeline metadata affects browser preview, while download exports the original stored MP4 without rendering trim/captions.
