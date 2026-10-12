# Foundation API contract

All user routes use `/api/v1`. Send `Authorization: Bearer <Firebase ID token>` and `Content-Type: application/json` for JSON bodies. The token must belong to the configured Firebase project. The server obtains the owner from the verified UID; callers cannot supply or change it.

Successful user responses have `{ "data": ..., "error": null, "requestId": "..." }`. Errors have `{ "data": null, "error": { "code": "...", "message": "..." }, "requestId": "..." }`. Use the safe message in the UI and request ID when diagnosing a failure. Do not log authorization tokens or API keys.

## Implemented foundation routes

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/health` | Public process health/configuration status; does not prove external services are reachable |
| GET | `/api/v1/health` | Public health alias; contains no user data |
| GET | `/api/v1/projects` | List the authenticated user's projects |
| POST | `/api/v1/projects` | Create an owned project and its initial editable scene |
| GET | `/api/v1/projects/:projectId` | Read an owned project |
| PATCH | `/api/v1/projects/:projectId` | Update validated project fields |
| DELETE | `/api/v1/projects/:projectId` | Delete an owned project and its current scene structure |
| POST | `/api/v1/projects/:projectId/duplicate` | Copy the editable project/scene structure with new IDs |
| GET | `/api/v1/projects/:projectId/scenes` | List the project's saved editable scenes |
| GET | `/api/v1/projects/:projectId/scenes/:sceneId` | Read an owned scene |
| PATCH | `/api/v1/projects/:projectId/scenes/:sceneId` | Save validated editable scene data |

The authoritative fields and bounds are the exported Zod schemas in `packages/shared/src`. Project creation accepts a title and optional description, for example `{ "title": "Neon Blade" }`; extra fields such as `ownerId` or `aspectRatio` are rejected. Ownership, IDs, timestamps, and the initial 16:9 aspect ratio are server managed. Scene PATCH accepts `title`, `canvas`, `shotPlan`, and `timeline`. Image objects return 409 `ASSETS_UNAVAILABLE` until the private asset milestone; duplication of existing image/asset references likewise returns an explicit 409. Scene data is editable JSON; an MP4 upload is not a scene-object serialization.

Missing/invalid Firebase tokens return 401. Missing projects and other users' projects return 404. Invalid input returns 400. Missing local backend configuration reports 503 rather than falling back to memory persistence. Server errors return a safe message; underlying cloud credentials or raw provider payloads must not be exposed. The API validates ownership even when a child scene ID is known.

## Not yet implemented

The following are planned P0 routes from `BUILD_PLAN.md`; they are not callable foundation features:

- Scene creation beyond the initial project scene: `POST /projects/:projectId/scenes`.
- Asset upload URL, upload completion, and authorized media URL endpoints.
- Scene analysis, generation, conversational edit, version listing/selection, and export endpoints.
- Job polling and the authenticated internal worker handler.

All future user routes inherit the same token, validation, and ownership requirements. Video generation/edit requests will enqueue jobs and return promptly. Worker authentication uses trusted Cloud Tasks OIDC identity, not Firebase user tokens or a header naming a queue. AI success is recorded only after validated real provider output is stored. Until those routes exist, use the opt-in server-side [AI smoke commands](model-verification.md) to test actual model access.
