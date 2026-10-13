# Project dashboard — UI U3

`/projects` is now a workspace rather than another landing page. The public homepage stays at `/`. The dashboard has an account disclosure, workspace navigation, a prominent New project action, an owned project library and dismissible getting-started guidance. Guidance can be reopened from the sidebar; it resets on a new dashboard visit.

Creating a named project immediately opens its blank saved editor. No analysis or generation is needed. Existing controls for drawing and importing remain in that editor; its full visual migration belongs to U4. Project cards expose open, rename, duplicate and confirmed delete actions. Duplication copies editable source and referenced original images, not generated clips. The cards show scene count and an absolute last-edited date, with a full timestamp tooltip.

Grid and list views share the same loaded collection. Search matches loaded project names, and sort applies only to loaded projects. The API's existing owner-scoped, ID-based cursor remains unchanged; the default page has 25 projects. A partial library explicitly says that more projects exist. A search with no loaded match still offers Load more when a cursor exists. Do not present the loaded count as a repository-wide total or the first page as globally most recent.

## Identity and states

The dashboard distinguishes restoring authentication, signed out, loading projects, empty library, no search match, populated library, pagination and errors. Refresh and retry remain available after failures. A 401 project-list failure offers Sign in again. Signing out clears the rendered library. A saved-project URL remains in place while signed out, allowing its owner to sign in and return to it. Guest sign-out warns that access can be lost and requires explicit confirmation; clearing browser data has the same risk. The unsaved playground is clearly separate from guest-owned saved projects.

Production Google sign-in and revoked cloud sessions still require release verification. Local tests cover actual anonymous emulator sign-in, refresh/session restoration, guarded sign-out, hidden project cards after sign-out and the signed-out saved-project destination. No successful cloud identity flow is claimed.

Native project dialogs trap Tab focus, accept Escape when idle, restore focus when possible and retain errors on failure. Native disclosure action menus support keyboard activation and Escape. Shared U1 tokens govern the dashboard's colors, focus, controls and reduced motion. Layouts adapt to desktop and phone; U6 still owns the broader accessibility audit.

## Private scene thumbnails

After a nonempty scene settles in a saved state for 700 ms, the editor renders its saved source through the existing canonical renderer at 0.25 scale, producing a 480×270 PNG. Zoom, pan and selection handles are excluded. Visible source images are fetched with authorization; a failed source read never becomes a fabricated success. The thumbnail task is optional: its failure cannot undo a source save or block editing. Leaving before it completes can leave the card without a preview. Reopening the saved scene retries it.

New owner-authenticated routes:

| Route | Behavior |
| --- | --- |
| `POST /api/v1/projects/:projectId/scenes/:sceneId/thumbnail?revision=N` | Accept a PNG of exactly 480×270, at most 600,000 input bytes. Decode/normalize on the server, then verify ownership and scene revision again when publishing. Returns the normal null-data envelope. |
| `GET /api/v1/projects/:projectId/thumbnail` | Return the first scene's current saved thumbnail as PNG, or HTTP 204 if none matches the current scene revision. Missing/foreign projects return 404; no identity returns 401. |

The existing private Cloud Storage asset path holds the PNG. Firestore `projects/{projectId}/thumbnails/{sceneId}` stores only `{ assetId, revision }`. The derived asset's ready state and thumbnail reference publish in one transaction; failed/interrupted publication uses the existing pending-asset cleanup process. Replacement marks the old derived asset for cleanup. Failed deletions remain retryable through `npm run cleanup:assets`; project deletion also removes thumbnails and their media. The editable scene schema and source asset references are unchanged.

GET responses use `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`. Browser cards fetch only thumbnails near the viewport, with a 15-second deadline. Blob URLs are revoked and requests aborted on teardown. The gallery never requests scene JSON or initializes Konva. The server checks only the first scene for each requested thumbnail; it does not render the library on demand. Thumbnail requests retain the production rate limit, and failures leave an explicit unavailable state.

Blank scenes, older projects and new duplicates show a deliberate empty preview until their source is opened and a current thumbnail is stored. A revision mismatch returns no preview rather than presenting the old artwork as current. These are actual saved-source previews, never AI examples. A client thumbnail is convenience presentation, not authoritative scene data or proof of content; analysis still renders its own canonical source.

## Configuration and rollout

No new credential, public bucket, signed URL, index or Firebase rule exception is required. Reuse the authenticated API, private bucket and runtime identity already documented in [cloud setup](cloud-setup.md). Keep the existing cleanup schedule from that runbook enabled in production. Firestore/Storage direct access stays denied; browser metadata contains no public media URL.

Deploy the API with the thumbnail routes before the new frontend. An older API simply leaves previews unavailable; editable source still saves. Production deployment and IAM remain deferred. For a complete local workspace, run `npm run dev:emulators`, open `http://127.0.0.1:5173/projects`, continue as a guest and create a project. No Google AI key is needed for these flows.

See [UI results](ui-upgrade-results.md) for actual checks and remaining gates.
