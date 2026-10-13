# API contract — editable scenes, private media and video revisions

All user routes use `/api/v1`. Send `Authorization: Bearer <Firebase ID token>` and `Content-Type: application/json` for JSON bodies. The token must belong to the configured Firebase project. The server obtains the owner from the verified UID; callers cannot supply or change it.

Successful JSON responses have `{ "data": ..., "error": null, "requestId": "..." }`; image/video content and MP4 export return binary bytes. Errors have `{ "data": null, "error": { "code": "...", "message": "..." }, "requestId": "..." }`. Use the safe message in the UI and request ID when diagnosing a failure. Do not log authorization tokens or API keys.

## Implemented routes

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/health` | Public process health/configuration status; does not prove external services are reachable |
| GET | `/api/v1/health` | Public health alias; contains no user data |
| GET | `/api/v1/projects?limit=25&cursor=...` | Owner-scoped cursor page, `{items,nextCursor}`; limit 1–100 |
| POST | `/api/v1/projects` | Create an owned project and its initial editable scene |
| GET | `/api/v1/projects/:projectId` | Read an owned project |
| GET | `/api/v1/projects/:projectId/thumbnail` | Private 480×270 first-scene PNG for the current revision, or 204 when unavailable |
| POST | `/api/v1/projects/:projectId/scenes/:sceneId/thumbnail?revision=N` | Raw 480×270 PNG, at most 600,000 bytes; owner/revision-checked derived preview publication |
| PATCH | `/api/v1/projects/:projectId` | Update validated project fields |
| DELETE | `/api/v1/projects/:projectId` | Hide the project, remove media and descendants, retain a private cleanup tombstone; safe to retry |
| POST | `/api/v1/projects/:projectId/duplicate` | Copy editable scenes and referenced images to fresh IDs/storage paths, publish only when complete |
| GET | `/api/v1/projects/:projectId/scenes` | List the project's saved editable scenes |
| GET | `/api/v1/projects/:projectId/scenes/:sceneId` | Read an owned scene |
| PATCH | `/api/v1/projects/:projectId/scenes/:sceneId` | Save editable scene data with required `expectedRevision` |
| GET | `/api/v1/ai/analysis-status` | Authenticated analysis configuration status; does not call Google or prove model entitlement |
| POST | `/api/v1/projects/:projectId/scenes/:sceneId/analyze` | Analyze an authorized saved canvas snapshot with the real server provider; return a validated suggestion |
| POST | `/api/v1/projects/:projectId/assets?sceneId=...&copyrightAttested=true` | Authenticated raw-image upload proxy; returns normalized asset metadata |
| GET | `/api/v1/projects/:projectId/assets/:assetId` | Owner-authorized asset metadata, excluding storage path |
| GET | `/api/v1/projects/:projectId/assets/:assetId/content` | Authenticated PNG bytes with `Cache-Control: private, no-store` |

The authoritative fields and bounds are the exported Zod schemas in `packages/shared/src`. Project creation accepts a title and optional description, for example `{ "title": "Neon Blade" }`; extra fields such as `ownerId` or `aspectRatio` are rejected. Ownership, IDs, timestamps, and the initial 16:9 aspect ratio are server managed. Project pagination uses a stable document-ID ordering; cursor ownership is checked, and callers must not assume a global last-edited order.

Scene PATCH requires `expectedRevision` and at least one of `title`, `canvas`, `shotPlan`, `timeline`, or `selectedVideoVersionId`. A successful transaction increments `revision`; older documents start at zero. Stale writes return 409 `SCENE_CONFLICT` without overwriting the saved scene. The server derives `sourceAssetIds` from image objects and verifies each asset's owner, project, readiness and crop bounds within the transaction. A non-null selected video must belong to this owner, project and scene. Callers cannot directly set asset references or revision. Scene JSON is capped by the API's 700,000-byte body limit and contains no embedded image bytes.

Upload with a raw file body and its `Content-Type` (`image/png`, `image/jpeg` or `image/webp`), not JSON/base64. Requests must affirm rights using the literal query value `copyrightAttested=true`. The server checks the signature, decodes the image, rejects animation and excessive dimensions, applies EXIF orientation, strips metadata and stores a normalized PNG. Source and normalized output are limited to 10 MiB, with at most 16 million pixels. This preserves the full picture, not a byte-identical copy of the uploaded file. Crop coordinates remain editable source-pixel metadata in the scene.

The upload proxy is the chosen alternative to signed upload URLs: registration and validation happen server-side, and browsers never receive bucket credentials or permanent public media URLs. Asset requests require an ID token every time; the frontend displays fetched image bytes through temporary browser Blob URLs. Private GCS paths are generated only on the server.

Dashboard thumbnails follow the same private-media boundary. Their ready asset and `{assetId,revision}` reference at `projects/{projectId}/thumbnails/{sceneId}` publish atomically. The server rejects invalid PNG dimensions and stale scene revisions. Derived thumbnails never replace source JSON, serve as analysis input automatically or become public URLs. Old previews use durable cleanup; see [dashboard lifecycle and rollout](dashboard.md).

Uploads reserve metadata before writing media, then finalize ownership/readiness. Project duplication keeps the destination hidden until its referenced images and scene documents can be published together, rechecking source revisions. Interrupted work uses durable reservations/tombstones for cleanup; startup and periodic retries complement retryable DELETE requests. Cloud Run cleanup caveats are in [cloud setup](cloud-setup.md).

Removing an image object does not delete its private source asset; media remains until project deletion to support undo and saved references. Duplicates copy only referenced images. Deleted projects retain a minimal `{id,ownerId,lifecycle,deletedAt}` tombstone indefinitely for late-write recovery, while content and media are removed. This MVP recovery scan requires batching/retention work before high-volume use.

Missing/invalid Firebase tokens return 401. Missing projects and other users' projects return 404. Invalid input returns 400. Missing local backend configuration reports 503 rather than falling back to memory persistence. Server errors return a safe message; underlying cloud credentials or raw provider payloads must not be exposed. The API validates ownership even when a child scene ID is known.

## Scene analysis

Save the editable scene first, export its full canvas to a 1920×1080 PNG, and upload it through the private asset proxy. The browser renders fresh Konva nodes at canonical resolution, loads visible images with authenticated requests, and excludes editor selections, zoom and pan. A failed image fetch/decode aborts export. The API verifies the uploaded snapshot's owner, project, scene, readiness and dimensions against a saved scene revision. The raster is a client export, not an independently re-rendered server proof of the canvas's pixels.

POST the following JSON to the scene's `/analyze` endpoint:

```json
{
  "analysisId": "bd7f7d76-d0c6-4fb9-ad7f-41ab407fd381",
  "expectedRevision": 4,
  "snapshotAssetId": "PRIVATE_SNAPSHOT_ASSET_ID",
  "notes": "Suggest a gentle camera move while preserving the original composition.",
  "copyrightAttested": true,
  "confirmPaid": true
}
```

Both affirmations are mandatory. Notes are limited to 8,000 characters. The server chooses the model; external image URLs, credentials, owner IDs and client-selected models are rejected. A scene must contain visible source content. Configuration requires `ENABLE_REAL_AI=true`, a server `GEMINI_API_KEY`, and the configured analysis model; the status route reports configuration only, without proving that Google will accept the key or model.

The success envelope contains `{analysisId,sourceRevision,snapshotAssetId,shotPlan,model,analyzedAt}`. The plan follows the shared strict schema. Provider interaction IDs stay in server-only records. Analysis does not change the source canvas or the saved shot plan. The user reviews the suggestion, applies it explicitly and saves it with the normal scene revision check. A suggestion is tied to its source revision; edits made while it was running must be reviewed before applying it.

The API reserves an analysis record and the user's daily attempt allowance together in Firestore before dispatch. The default allowance is 20 attempts per UTC day, with a 90-second per-user reservation while an analysis is running or uncertain. Failures consume an attempt. Reusing an analysis ID with the same request replays a completed result or its recorded failure without a new model call; altered input returns 409. A pending/uncertain ID is never automatically dispatched again, even after a server restart. Starting another request requires an explicit new ID and can incur another charge. The existing provider retries only explicit 429 rejections within its deadline; ambiguous network/server failures are not retried.

The analysis provider deadline defaults to 40 seconds and may be configured from 1 to 45 seconds with `ANALYSIS_TIMEOUT_MS`. The browser waits longer than that deadline. An upstream timeout can still leave a charge at Google; inspect provider activity before starting another request. Quota/busy errors return 429, stale scene/request conflicts 409, disabled or unavailable credentials/configuration 503, invalid structured results 502, and provider timeouts 504. Safe errors never expose SDK messages, keys, image bytes or provider interaction IDs.

Private analysis records and snapshots remain with their project until project deletion. The per-user usage record is separate, so deleting a project cannot reset the daily allowance. The local emulator launcher keeps Google calls disabled. Test suites inject an explicitly labeled provider fixture in isolated tests only; no runtime environment switch silently returns a fake successful plan.

## Queued video generation

All user routes below require Firebase bearer authentication and project ownership. The API returns the normal envelope; private metadata and media use `Cache-Control: private, no-store`.

| Method | Route under `/api/v1` | Result |
| --- | --- | --- |
| GET | `/ai/video-status` | Configuration availability, not proof of entitlement |
| POST | `/projects/:projectId/scenes/:sceneId/generate` | 202 with durable job; no browser wait on Google |
| GET | `/projects/:projectId/jobs/:jobId` | Current state or safe terminal error |
| GET | `/projects/:projectId/scenes/:sceneId/jobs` | Latest 30 jobs, newest first |
| GET | `/projects/:projectId/scenes/:sceneId/versions` | Latest 30 immutable public version records |
| GET | `/projects/:projectId/versions/:versionId` | One owned version's public metadata, including versions outside the latest 30 |
| GET | `/projects/:projectId/versions/:versionId/content` | Authenticated whole-file `video/mp4` response |
| POST | `/projects/:projectId/scenes/:sceneId/versions/:versionId/edit` | 202 with a durable edit job tied to an immutable parent |
| PATCH | `/projects/:projectId/scenes/:sceneId/select-version` | Revision-checked persisted selection; returns the saved scene |
| POST | `/projects/:projectId/export` | Original stored MP4 attachment for an owned scene/version pair |

Generation accepts only `{jobId,expectedRevision,snapshotAssetId,copyrightAttested:true,confirmPaid:true}`. `jobId` is a client UUID persisted in session storage before dispatch. A full-size private PNG and a schema-valid saved shot plan are required. Source revision, plan and assembled prompt are captured transactionally. The combined prompt limit is 8,000 characters; preview it before approving charges. A changed request with an existing ID returns 409; an identical ID replays its state without spending quota or creating a second generation. Quota/busy errors return 429. Failed attempts count against the per-user daily limit.

The private worker is a **separate process** with `POST /internal/jobs/execute`, accepting only `{projectId,jobId}` and a verified Google OIDC token for the exact Tasks service account and worker origin. This handler does not exist on the public API. Cloud Tasks retries requests with active leases or recoverable media failures. Durable state and a scheduled recovery job cover lost queue submissions and abandoned workers. See [worker deployment and exact deadlines](video-worker-setup.md).

The worker persists a completed Google file reference before downloading it. File/storage failures resume that existing file, with at most three worker claims. Ambiguous dispatch failures are terminal and never automatically regenerate; the user must inspect AI Studio before a new paid ID. Successful GCS bytes and immutable version publication precede `succeeded`. Versions expose the saved prompt/plan/revision, parent ID, generation kind, edit mode, model, size and timestamps, but no provider interaction ID, content digest or bucket path. A generation or edit never changes the current drawing, timeline or selected version. The UI opens the saved selection, or previews the latest completed version when none is selected; **Use this version** persists an explicit selection.

MP4 bytes are limited to 100 MiB with a container sanity check. The browser downloads the whole authorized file into a Blob and reports codec/playback errors; no public bucket URL, signed download URL or range proxy is involved. Source snapshots, checkpoint records and versions stay private until project deletion. A deletion tombstone prevents late workers from publishing descendants, and the separate media cleanup sweep removes late writes.

## Conversational and stored-video edits

POST this JSON to `/projects/:projectId/scenes/:sceneId/versions/:versionId/edit`:

```json
{
  "jobId": "262e24d9-e8c8-4d8b-986c-a22b8eae9d35",
  "prompt": "Slow the camera movement and preserve the original character design.",
  "mode": "interaction",
  "copyrightAttested": true,
  "confirmPaid": true
}
```

The prompt is trimmed and must contain 1–8,000 characters. `mode` defaults to `interaction`; the other permitted value is `upload`. Both affirmations are required for either mode. The client cannot provide a model, provider interaction ID, video URL, storage path or arbitrary video bytes. The server checks the parent version's owner, project and scene, then captures the immutable parent's original snapshot, plan and source revision together with the new prompt and mode. A mutable-scene revision is not required for edits of an immutable version. The parent ID in the URL is the edit source, independently of which version is selected for the scene.

The edit shares the generation queue, per-user daily allowance and single-active-job limit. Its idempotency fingerprint includes the operation kind, scene, parent version, normalized prompt and mode. An identical job ID replays the existing state; changing any captured input returns 409 `JOB_ID_CONFLICT`. The browser preserves uncertain submissions in session storage, so **Retry same video edit** uses the original ID, parent, prompt and mode. Starting a new paid attempt requires a new ID.

`interaction` uses the parent's server-only Google interaction reference. Missing local context returns 409 `INTERACTION_UNAVAILABLE` before reserving a job. A Google rejection for missing context appears on the failed job as `AI_EDIT_CONTEXT_UNAVAILABLE`. Neither error automatically uploads a video or starts another paid call. `upload` explicitly starts a new conversation from the owned stored MP4, with server checks for size, digest and a finite movie-header duration at most 10 seconds before upload. Duration errors appear as `AI_UPLOAD_DURATION_UNKNOWN` or `AI_UPLOAD_TOO_LONG`. Local timeline trim does not shorten this input. Google's regional/feature limitations and temporary-file retention are documented in [model verification](model-verification.md).

Both modes create a fresh immutable version with `generationKind: "edit"`, `parentVersionId`, `editMode` and the submitted prompt. Initial versions use a null parent/mode. The new provider interaction stays server-side. Failed jobs leave existing media, prompts, scene data and selection intact. Job re-delivery with a saved output checkpoint resumes only that output; it does not repeat the edit. The comparison UI loads the immediate parent independently, including a parent outside the latest 30 versions.

## Selection, timeline metadata and MP4 export

PATCH `/projects/:projectId/scenes/:sceneId/select-version` with `{ "expectedRevision": 4, "versionId": "OWNED_VERSION_ID" }`, or `versionId: null` to clear selection. The normal scene PATCH accepts the same choice as `selectedVideoVersionId`, allowing selection and timeline edits to save together. Both paths enforce ownership and scene membership transactionally and use the same revision/conflict rules as canvas saves. Reverting means selecting an existing version; it does not delete revisions, restore the drawing, call Google or change any MP4.

Timeline is saved with the scene as `{trimStart,trimEnd,captions}`. Times are seconds on the original clip clock, bounded to 0–300. `trimEnd: 0` means the full remaining clip; otherwise it must exceed `trimStart`. Up to 50 uniquely identified captions contain `{id,text,start,end}` with text at most 1,000 characters and `end > start`. The browser checks these values against decoded clip duration before saving and displays trim/captions during preview. Switching versions retains timeline settings for review. The API validates structure and ranges; it does not decode every clip to establish actual duration for scene PATCH.

Scene reads preserve historical Phase 4-valid equal endpoints and duplicate caption IDs unchanged. New timeline writes require the stricter intervals and unique IDs above. The UI explains the correction, offers reset trim and explicit caption-ID repair, and retains all caption text/times when repairing IDs. No migration silently drops those values.

POST `/projects/:projectId/export` with `{ "sceneId": "SCENE_ID", "versionId": "OWNED_VERSION_ID" }`. The server verifies ownership and scene membership, checks stored size/digest, and returns the exact stored MP4 with `Content-Type: video/mp4`, `Content-Disposition: attachment`, and `Cache-Control: private, no-store`. It does not encode trim, captions or a multi-clip composition. The UI labels this **Download original MP4** and separately downloads editable timeline JSON from the browser. Selection, comparison and downloads make no new AI call. No public or signed media URL is issued.

## Not yet implemented

The following remain planned routes from `BUILD_PLAN.md`:

- Scene creation beyond the initial project scene: `POST /projects/:projectId/scenes`.
- Separate signed upload/completion/media URL endpoints are unnecessary for the implemented authenticated proxy; they can be added if direct storage transfer is needed later.
- Encoded export that renders trims/captions or combines multiple clips; the implemented export is a single original MP4.

Future user routes inherit the same token, validation, and ownership requirements. Use the opt-in server-side [AI smoke commands](model-verification.md) and the queued live acceptance flow to verify actual Google model access. Labeled test fixtures are not live-model evidence.
