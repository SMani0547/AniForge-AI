# Video activation — October 15, 2026

Video generation is enabled on the live API. This record separates real provider output, deployed recovery/storage checks and the remaining signed-in browser acceptance test. No application source changed during this setup; the previously tested image was reused.

## Real Google output

- Model: `gemini-omni-1.1-flash`, using the replacement server key already verified for analysis. The owner authorized the video setup and one bounded real generation test.
- Input: the repository's original `apps/web/public/artwork/sky-artist.webp`, with original-content affirmation. The prompt requested four seconds of subtle hair/jacket movement and a slight stylus lift. Exact prompt and provider provenance are saved privately with the output.
- Request: stored Interactions response, URI delivery, 720p, 16:9, 300,000 ms deadline. Official [Omni request and file retrieval documentation](https://ai.google.dev/gemini-api/docs/omni) was rechecked October 15.
- Result: **1,906,656-byte MP4 in 40,886 ms**, with a real provider interaction and resumable file checkpoint. No replacement or fabricated video was used.
- Local Chromium played the MP4 to its end without a media error: **4.01 seconds, 1280 × 720, 96 decoded frames**. A playback frame was visually inspected. The landscape framing crops the reference character; playback verification does not establish that every requested visual detail was followed.
- Private artifacts: `artifacts/ai-smoke/video-ae1e2a91-58bb-477b-baea-70cb3d65ce00/` contains `interaction.json`, `checkpoint.json`, `metadata.json`, `video.mp4`, `playback-frame.png` and `playback-verification.json`. These are ignored by Git, Docker and Cloud Build. Do not publish interaction IDs or provider media locations.
- Actual account charges and remaining credit balance were not read or inferred. No real edit request was made.

## Credentials, identities and cloud configuration

Infrastructure remains in `aniforge-511502`, region `us-central1`, bucket `aniforge-511502-private-media`. The Gemini API key can belong to the separately billed AI project; it remains a server secret. No new API key, password, downloaded service-account key or browser secret is required.

Enabled `cloudtasks.googleapis.com`, `cloudscheduler.googleapis.com` and `iamcredentials.googleapis.com`. Existing Firestore job/version indexes and the job-status collection-group index reported `READY`.

| Identity | Grants used |
| --- | --- |
| `aniforge-api@aniforge-511502.iam.gserviceaccount.com` | Existing application permissions; queue-scoped `roles/cloudtasks.enqueuer`; `roles/iam.serviceAccountUser` on the task invoker identity |
| `aniforge-worker@aniforge-511502.iam.gserviceaccount.com` | Project `roles/datastore.user`; bucket-scoped `roles/storage.objectUser`; accessor on `aniforge-gemini-api-key` only |
| `aniforge-tasks-invoker@aniforge-511502.iam.gserviceaccount.com` | `roles/run.invoker` on the private worker only; no Firestore, media or secret grants |
| `aniforge-video-recovery@aniforge-511502.iam.gserviceaccount.com` | Project `roles/datastore.user`; queue enqueuer; service-account user on the task invoker; no Gemini secret or bucket grant |
| `aniforge-cleanup-scheduler@aniforge-511502.iam.gserviceaccount.com` | Invoker on the video recovery job; despite its name, no media-deletion job or schedule was created |

Google-managed Tasks and Scheduler service agents have their standard service-agent roles. No project-level `roles/run.invoker` binding was found. Worker service IAM contains only the dedicated task identity, with neither public principal granted invocation.

Queue `aniforge-generation`: one dispatch/second, two concurrent dispatches, at most 20 attempts over 1,800 seconds, backoff 30–120 seconds. Attempt logging is enabled. The application ledger separately prevents repeated model creation for a dispatched job, and limits checkpoint retrieval claims to three. [Cloud Tasks OIDC](https://docs.cloud.google.com/tasks/docs/creating-http-target-tasks) authenticates each request to the exact worker origin.

All services/jobs use image `us-central1-docker.pkg.dev/aniforge-511502/aniforge/api@sha256:dfbe73fe79ea16251461bb33e98756c748702c18122cae6162a9c80d26bbecda`.

- **Worker:** `aniforge-worker-00003-h7g`, ready with 100% traffic. Canonical origin `https://aniforge-worker-ramx6nybyq-uc.a.run.app`; entry point `node /app/apps/api/dist/worker.js`; 1 GiB, one CPU, concurrency one, zero minimum/two maximum instances, 450-second request timeout. Both AI/video switches are true. `AI_TIMEOUT_MS=300000`, `GEMINI_VIDEO_MODEL=gemini-omni-1.1-flash`; key bound to Secret Manager version `aniforge-gemini-api-key:1`.
- **Public API:** `aniforge-api-00008-kxk`, ready with 100% traffic. Video enabled; maximum three accepted generation/edit attempts per user per UTC day. This is not a project-wide spending cap. Queue location/name, worker origin and task identity are configured; existing analysis/Firebase/CORS settings are preserved.
- **Recovery:** Cloud Run job `aniforge-video-recovery`, one task, one parallel task, 512 MiB, 300-second timeout, two retries, entry point `node /app/apps/api/dist/recover-videos.js`. It needs Firestore/queue settings and ADC, not the Gemini key. Scheduler runs `*/5 * * * *` UTC, POSTing to the Run v2 `:run` endpoint with the scheduler identity's OAuth token. Manual execution `aniforge-video-recovery-ngdnw` and scheduler-created execution `aniforge-video-recovery-w77cd` completed successfully. Initial executions waited roughly two minutes for Cloud Run startup; this was not an application failure.
- **Local environment:** ignored `apps/api/.env` now has the matching video enablement, queue, worker URL, invoker and daily limit. Restart local development processes to load changes. Existing key and Firebase project are preserved.

## Deployed verification

1. Anonymous worker POST returned 403; an invalid bearer token returned 401. A correctly signed Cloud Tasks request for a nonexistent job returned **204**, with no model call.
2. An isolated operator verification project was created for recovery of the already-generated real clip. The original local smoke checkpoint was recorded explicitly as an out-of-band provider result; the server did not pretend to generate it again. Its canonical snapshot was derived from the same original artwork. The recovery record retains the exact original generation prompt and an `operatorVerification` marker. IDs are saved in ignored `cloud-verification.json`; this is not the owner's project or signed-in browser session.
3. Cloud Tasks delivered the checkpoint to the actual worker. The worker downloaded Google's existing file, wrote private GCS media and published an immutable Firestore video version. State reached **succeeded**, with two ledger claims (operator checkpoint setup, then actual worker recovery).
4. Read-back matched the local provider MP4 byte-for-byte; SHA-256 `5d3f8420f4a08b5ca96cc89293d6041b8484993de4c9818b10e76d2754e7b9c0`, stored content type `video/mp4`. Anonymous object GET returned **403**. `cloud-storage-verification.json` records these results. The verification project/media remain private for operator inspection; no user media was deleted.
5. API health returned 200; unauthenticated projects/video-status requests returned 401; custom-domain preflight returned 204 and the correct `https://aniforge.shivafj.dev` allow-origin header.
6. A separate signed task redelivered the completed verification job. Cloud Tasks logged response `OK`; the ledger remained succeeded with two claims, one video version and the same hash. No new model generation was performed. Results are in ignored `redelivery-verification.json`.

Typecheck, lint, **208 unit tests in 15 files**, release build and the **32-file browser artifact scan** passed during this activation. Existing Zod annotation and Google Storage stream-listener warnings were non-blocking. The 40 emulator/browser tests passed in the preceding fix; they were not rerun for this configuration-only phase. No frontend publication was required.

## Remaining checks and deferred cleanup

Refresh the live site, save the applied shot plan, open **Video**, review the prompt and affirm both ownership and paid generation, then click **Generate animation**. Verify that it queues promptly, succeeds, plays after reload and downloads. This fresh authenticated production generation flow has not yet been observed; the real provider smoke and deployed checkpoint recovery above are separate evidence. Conversational edit and uploaded-video edit also remain unverified against Google.

Automatic approval review rejected creation of the separate 30-minute `aniforge-media-cleanup` job/schedule because it can delete private media and was not considered specifically authorized by the video-enablement request. It was not created, and no workaround was used. The existing API cleanup behavior was not changed. After a separate approval question, the owner chose **Keep media cleanup deferred**. Idle-time media cleanup therefore remains deferred by explicit preference. Video outbox recovery is configured and verified independently.

The repeatable setup and shutdown procedures remain in [video worker setup](video-worker-setup.md). To stop new paid submissions, disable video on the API; pause the queue and disable real AI on the worker to stop undispatched queued work. Already accepted provider calls may still complete.
