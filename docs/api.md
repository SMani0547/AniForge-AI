# API contract — saved canvas and private images

All user routes use `/api/v1`. Send `Authorization: Bearer <Firebase ID token>` and `Content-Type: application/json` for JSON bodies. The token must belong to the configured Firebase project. The server obtains the owner from the verified UID; callers cannot supply or change it.

Successful user responses have `{ "data": ..., "error": null, "requestId": "..." }`. Errors have `{ "data": null, "error": { "code": "...", "message": "..." }, "requestId": "..." }`. Use the safe message in the UI and request ID when diagnosing a failure. Do not log authorization tokens or API keys.

## Implemented routes

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/health` | Public process health/configuration status; does not prove external services are reachable |
| GET | `/api/v1/health` | Public health alias; contains no user data |
| GET | `/api/v1/projects?limit=25&cursor=...` | Owner-scoped cursor page, `{items,nextCursor}`; limit 1–100 |
| POST | `/api/v1/projects` | Create an owned project and its initial editable scene |
| GET | `/api/v1/projects/:projectId` | Read an owned project |
| PATCH | `/api/v1/projects/:projectId` | Update validated project fields |
| DELETE | `/api/v1/projects/:projectId` | Hide the project, remove media and descendants, retain a private cleanup tombstone; safe to retry |
| POST | `/api/v1/projects/:projectId/duplicate` | Copy editable scenes and referenced images to fresh IDs/storage paths, publish only when complete |
| GET | `/api/v1/projects/:projectId/scenes` | List the project's saved editable scenes |
| GET | `/api/v1/projects/:projectId/scenes/:sceneId` | Read an owned scene |
| PATCH | `/api/v1/projects/:projectId/scenes/:sceneId` | Save editable scene data with required `expectedRevision` |
| POST | `/api/v1/projects/:projectId/assets?sceneId=...&copyrightAttested=true` | Authenticated raw-image upload proxy; returns normalized asset metadata |
| GET | `/api/v1/projects/:projectId/assets/:assetId` | Owner-authorized asset metadata, excluding storage path |
| GET | `/api/v1/projects/:projectId/assets/:assetId/content` | Authenticated PNG bytes with `Cache-Control: private, no-store` |

The authoritative fields and bounds are the exported Zod schemas in `packages/shared/src`. Project creation accepts a title and optional description, for example `{ "title": "Neon Blade" }`; extra fields such as `ownerId` or `aspectRatio` are rejected. Ownership, IDs, timestamps, and the initial 16:9 aspect ratio are server managed. Project pagination uses a stable document-ID ordering; cursor ownership is checked, and callers must not assume a global last-edited order.

Scene PATCH requires `expectedRevision` and at least one of `title`, `canvas`, `shotPlan`, or `timeline`. A successful transaction increments `revision`; older documents start at zero. Stale writes return 409 `SCENE_CONFLICT` without overwriting the saved scene. The server derives `sourceAssetIds` from image objects and verifies each asset's owner, project, readiness and crop bounds within the transaction. Callers cannot directly set asset references or revision. Scene JSON is capped by the API's 700,000-byte body limit and contains no embedded image bytes.

Upload with a raw file body and its `Content-Type` (`image/png`, `image/jpeg` or `image/webp`), not JSON/base64. Requests must affirm rights using the literal query value `copyrightAttested=true`. The server checks the signature, decodes the image, rejects animation and excessive dimensions, applies EXIF orientation, strips metadata and stores a normalized PNG. Source and normalized output are limited to 10 MiB, with at most 16 million pixels. This preserves the full picture, not a byte-identical copy of the uploaded file. Crop coordinates remain editable source-pixel metadata in the scene.

The upload proxy is the chosen alternative to signed upload URLs: registration and validation happen server-side, and browsers never receive bucket credentials or permanent public media URLs. Asset requests require an ID token every time; the frontend displays fetched image bytes through temporary browser Blob URLs. Private GCS paths are generated only on the server.

Uploads reserve metadata before writing media, then finalize ownership/readiness. Project duplication keeps the destination hidden until its referenced images and scene documents can be published together, rechecking source revisions. Interrupted work uses durable reservations/tombstones for cleanup; startup and periodic retries complement retryable DELETE requests. Cloud Run cleanup caveats are in [cloud setup](cloud-setup.md).

Removing an image object does not delete its private source asset; media remains until project deletion to support undo and saved references. Duplicates copy only referenced images. Deleted projects retain a minimal `{id,ownerId,lifecycle,deletedAt}` tombstone indefinitely for late-write recovery, while content and media are removed. This MVP recovery scan requires batching/retention work before high-volume use.

Missing/invalid Firebase tokens return 401. Missing projects and other users' projects return 404. Invalid input returns 400. Missing local backend configuration reports 503 rather than falling back to memory persistence. Server errors return a safe message; underlying cloud credentials or raw provider payloads must not be exposed. The API validates ownership even when a child scene ID is known.

## Not yet implemented

The following remain planned routes from `BUILD_PLAN.md`:

- Scene creation beyond the initial project scene: `POST /projects/:projectId/scenes`.
- Separate signed upload/completion/media URL endpoints are unnecessary for the implemented authenticated proxy; they can be added if direct storage transfer is needed later.
- Scene analysis, generation, conversational edit, version listing/selection, and export endpoints.
- Job polling and the authenticated internal worker handler.

All future user routes inherit the same token, validation, and ownership requirements. Video generation/edit requests will enqueue jobs and return promptly. Worker authentication uses trusted Cloud Tasks OIDC identity, not Firebase user tokens or a header naming a queue. AI success is recorded only after validated real provider output is stored. Until those routes exist, use the opt-in server-side [AI smoke commands](model-verification.md) to test actual model access.
