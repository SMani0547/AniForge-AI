# UI upgrade results

## Follow-up — continuous red meteor bodies

October 14, 2026. Removed the separate flame polygons, pale core and head glow so the leading edge is part of the same red stroke as the body. Retained three tapered trails and matched their shedding embers to the same red. Browser motion checks now measure the visible trail itself.

Actual results: typecheck, lint, 200 unit tests, all 14 browser checks (26.7 seconds), production release build and the bounded 32-file artifact scan passed. Reviewed the updated hero screenshot for the removal of the separate tip. Existing Zod annotation and Playwright color warnings remain non-blocking. No deployment, emulator rerun or paid API request was performed; no credentials are needed for this change.

## Follow-up — flame tips and shedding embers

October 14, 2026. Replaced the rounded white dash and hard halo with a pointed, asymmetric flame, warm core and radial heat glow. Each of the three meteors sheds seven small embers that drift backward/outward and fade. Flame groups follow the same SVG curves and timing as their red wakes; pause freezes heads, tails and embers, and reduced motion disables their animations. No new dependency or credential is required.

Actual results: typecheck, lint, 200 unit tests, a focused browser motion check, all 14 browser tests (43.9 seconds), production release build and the bounded 32-file artifact scan passed. The focused hero capture was visually reviewed; [final full-suite capture](ui-motion-rhythm/hero-meteor-flames.png) is retained. Existing Zod annotation and Playwright color warnings remain. No deployment, emulator rerun or paid Google request was performed.

## Follow-up — three thicker meteor trails

October 14, 2026. Added a third curved flight path and replaced the sparse trail layers with twelve overlapping strokes that grow wider and brighter toward the glowing head. Increased the head and halo thickness for a meteor-like silhouette; the three loops use independent 12/17/15-second timings. Pause and reduced-motion behavior remain supported.

Actual results: typecheck, lint, 200 unit tests, all 14 browser checks (25.4 seconds), production release build and the bounded 32-file artifact scan passed. Reviewed the [three-meteor hero capture](ui-motion-rhythm/hero-three-meteors.png). Existing Zod/Rollup annotation and Playwright color warnings remain non-blocking. No deployment, emulator rerun or paid API request was performed; no additional credentials are required.

## Follow-up — smooth hero lettering and red orbit lights

October 14, 2026. Replaced abrupt one-millisecond letter steps with overlapping 280 ms fades, 65 ms apart, following a shorter hero entrance. Removed the blinking caret. Two red lights now follow closed SVG curves with layered fading tails and independent 12/17-second loops. The animation uses CSS, with no added dependency, blur filter or per-frame JavaScript. Pause freezes the lights in place; resume continues their travel, while reduced motion leaves static artwork and fully visible text.

Actual validation: typecheck and lint passed; 200 unit tests passed across 15 files; all 14 browser tests passed (41.0 seconds), followed by a focused motion/screenshot check (one pass). The production release build and bounded 32-file artifact scan passed. The first browser run exposed discrete SVG dash interpolation; explicit length units fixed it, and the final checks verify movement, pause, resume and live reduced-motion changes. Initial restricted-shell unit/focused-browser starts hit esbuild filesystem access errors; reruns outside the sandbox passed. Existing Zod annotation and Playwright color warnings remain non-blocking.

Reviewed the [final hero capture](ui-motion-rhythm/hero-red-trails.png); the full suite also checks 1440/768/600/390px layout and overflow. This is local validation, not a claim of measured performance on every device. No deployment, Firebase emulator rerun or paid Google request was made. No new credentials are required.

## Follow-up — staggered reveals, typing and angular headings

October 14, 2026. Replaced whole-section reveals with individual content reveals lasting 1.0–1.2 seconds and 170 ms sibling offsets (capped at 510 ms). Added a one-time hero typing effect, short-lived caret and heading accent-line reveals. Homepage headings now use locally hosted Oxanium with its SIL OFL license; body text retains the system font. Pause/reduced motion reveal all content and complete typing; focus and fast scrolling cannot strand hidden controls. Interactive regions fade without translation after the first test run exposed a click/focus layout shift.

Actual results: final typecheck and lint passed; 200 unit tests passed; all 14 browser checks passed on rerun (20.6 seconds); production release build and bounded 31-file artifact scan passed. Existing Zod annotation warnings remain non-blocking. Desktop, 600px and phone captures were visually reviewed. No Firebase emulator rerun or deployment was performed. See [behavior, font provenance and screenshots](ui-motion-rhythm/README.md).

## Follow-up — owner-supplied logo integration

October 14, 2026. Cropped the supplied transparent logo into native PNG masters and optimized wordmark, monogram and full-logo WebP variants without regenerating the design. Shared production navigation uses the wordmark on desktop and the monogram on phones; the hero uses the wordmark, while the footer and README use the complete logo. Added browser/touch icons and updated the social preview. Original source remains unchanged.

Actual checks: typecheck, lint, 200 unit tests, 13 browser checks (35.6 seconds), production release build and the bounded 29-file browser-artifact scan passed. Desktop and phone placements were visually reviewed. No production deployment or paid AI call was made; Firebase emulators were not rerun for this image/component change. See [crops, provenance and placement screenshots](brand/README.md).

## Follow-up — reference-led anime homepage

October 14, 2026. Inspected the supplied 17.37-second ArtCraft recording and adapted its dark grid, large wordmark, floating media and restrained typography into an AniForge homepage with an original anime artist and coastal scene. Two illustrations were generated with the built-in image tool and saved as local WebP assets. Their motion is CSS animation with pause/reduced-motion support, not animated GIFs or AniForge-generated video. Removed the cursor follower and simplified transitions. Existing app entry links and interactive source examples remain functional.

Actual checks: typecheck, lint, 200 unit tests, all 13 browser checks, final production release build and the bounded 21-file artifact scan passed. Four focused homepage tests passed again after refinements, including 1440/768/600/390px layouts, pause/resume and live reduced-motion changes. The local production loading review passed with no external or app-service requests; transfer was 483,516 bytes per fresh context, with 168–184 ms LCP on unthrottled loopback. These are local measurements, not production performance claims. Firebase emulators and paid Google model tests were not rerun. No deployment was performed.

See [reference review, screenshots, asset provenance, prompts and measurements](ui-anime-homepage/README.md). The generated artwork is promotional; real Google output remains a separate verification gate.

## Follow-up — homepage typography and motion

October 14, 2026. Added warm editorial typography, an arched artwork frame, entrance transitions, one-time scroll reveals, subtle parallax, artwork hover depth, reading progress and a pointer accent limited to artwork. Native scrolling, keyboard navigation and the system cursor remain intact. Motion stops under reduced-motion settings, including preference changes while the page is open. No dependency or external font request was added.

Validation: typecheck and lint passed; 200 unit tests passed; 13 browser checks passed (27.3 seconds). After clamping the cursor accent at viewport edges, all four homepage checks passed again (26.3 seconds), including focused-content reveal and reduced motion. Final typecheck, lint, production release rebuild and bounded 19-file browser-artifact scan passed. The homepage chunk is 20.66 kB JS (6.58 kB gzip) and 19.14 kB CSS (4.53 kB gzip). Existing Zod annotation and Playwright color-environment warnings remain. No Firebase emulator rerun was needed for this homepage-only update; no paid AI request was made.

See [reviewed desktop/phone captures and motion behavior](ui-home-motion/README.md). Publication to Firebase Hosting remains a separate step.

## Follow-up — saved-project header parity

Recorded October 14, 2026 (Pacific/Fiji). Saved projects now use the shared AniForge brand, studio navigation, Account menu and theme instead of the legacy application header. Phone navigation wraps below the brand/account row. Loading, sign-in and error states use the shared presentation. Drawing, saving and navigation guards retain their existing behavior.

Actual validation: typecheck and lint passed; 200 unit tests passed across 15 files; 12 browser checks passed (18.0 seconds); 40 emulator checks passed (1.8 minutes); `npm.cmd run build:release` and the bounded browser-artifact scan passed (19 files). The initial browser run exposed a stale social-image assertion after the earlier production metadata update; the assertion now matches the configured absolute URL and the complete suite passed on rerun. Existing Rollup annotation, Java Unsafe and emulator listener warnings remain visible.

Reviewed [desktop](ui-saved-shell/workspace-source-1440.png) and [phone](ui-saved-shell/workspace-mobile-canvas.png) captures from the real local emulator run. The red Firebase emulator banner is test-only. Responsive regression checks also covered 1280px, 768px and 720 x 450 reflow, account-menu Escape/focus return, saved reload and unsaved navigation protection. Provider output in these tests uses explicit fixtures; no paid Google request was made.

The production release build is ready locally. This change has not been deployed to Firebase Hosting; publishing the frontend is still required to update the live site. No backend change is needed for this header update.

## Follow-up — sketch playground UI parity

Recorded October 13, 2026 (Pacific/Fiji). **Local playground redesign passed.** The unsaved `/studio/preview` now uses the shared dashboard header, theme and controls, with a labeled drawing rail, color palette, larger canvas area and refreshed scene assistant. Tablet layouts move the assistant below the canvas; phones use compact tools above it. [Six actual captures](ui-playground/README.md) document desktop, tablet, phone and zoom-equivalent reflow.

Drawing retains canonical 1920 x 1080 coordinates, pencil/brush/eraser, undo/redo and undoable clearing. Pointer cancellation finishes the current stroke. Navigation and reload warnings remain in place; sign-in no longer changes the playground component key. The drawing is explicitly temporary and does not transfer into a saved project. Disabled AI controls explain that no AI requests are sent.

| Command / check | Actual result |
| --- | --- |
| `npm.cmd run typecheck` | Passed shared/API/web and tooling; repeated after final app-shell change. |
| `npm.cmd run lint` | Passed; repeated after final app-shell change. |
| `npm test` | 200 tests passed across 15 files. |
| `npm run test:e2e` | Final run: 12 passed in 34.9 seconds, zero retries. |
| `npm run test:emulators` | 40 passed in 2.3 minutes, zero retries; actual local Auth/Firestore/Storage and explicitly labeled provider fixtures. |
| `npm run build` | Shared/API/web build passed; artifact scan passed across 19 files. Playground CSS stays in its lazy route chunk (6.01 kB / 1.64 kB gzip). |
| Visual / interaction review | 390/768/1280/1440 widths and 720 x 450 reflow passed. Pointer drawing, tool/color selection, clear/undo recovery, history, cancelled project navigation and refresh behavior pass. No AI requests observed in the playground smoke scenario. |

The first browser run found temporary horizontal overflow when the Konva stage retained its previous width during a viewport change (11 passed, 1 failed). The canvas now clips its own drawing surface during ResizeObserver updates; the complete rerun passed. History tooltips also anchor inward at the canvas edge. No page-wide overflow hiding was added.

Non-blocking output included the existing Zod/Rollup annotation, color-environment, Java Unsafe and emulator test listener warnings. No new dependencies, credentials or cloud services were added. Real Firebase production sign-in, Google analysis/video/edit, worker IAM and deployment remain deferred under the existing [release checklist](release-checklist.md); these local results do not validate them. Manual screen-reader, native zoom and additional browser/device reviews are not claimed.

## U6 — local accessibility, performance and release review

Recorded October 13, 2026 (Pacific/Fiji). **Local U6 review passed. Cloud release remains deferred.** [Review scope and remaining limits](ui-release-review.md), [14 captures and raw measurements](ui-u6/README.md) and the roadmap are updated.

### Findings and changes

- Cancelling browser Back previously pushed a replacement history entry. Indexed app history now restores the existing entry, preserving forward navigation. Saved drafts and unsaved playground drawings are guarded; the playground also warns on refresh/close.
- App routes now have distinct titles and focusable main landmarks. Route changes focus main content, image-import dialogs restore trigger focus, and editor shortcut help supports Escape. Existing project-dialog focus trapping/return, labeled inputs, layer actions, status/error announcements and reduced motion remain covered.
- Visual review found tablet navigation overlapping the next section at 720–768px. The editor header now grows to contain wrapped navigation; a bounds assertion prevents regression.
- Hidden Video views now defer private MP4 downloads until a player is first shown. Loaded players retain media across view changes, and job polling/request recovery continue without automatic paid calls. The homepage still loads independently of Firebase, Konva and editor code.
- Playground copy now describes its current unsaved scope instead of promising a later milestone. No dependency, credential, API schema or cloud service was added.

### Actual validation

| Command / check | Result |
| --- | --- |
| `npm.cmd run typecheck` | Passed shared/API/web and tooling, including new browser tests. |
| `npm.cmd run lint` | Passed. |
| `npm test` | 200 tests passed across 15 files. |
| `npm run test:e2e` | 12 tests passed in 40.8 seconds, zero retries. |
| `npm run test:emulators` | 40 tests passed in 1.9 minutes, zero retries. |
| `npm run build` | Shared/API/web production build passed; artifact scan passed across 17 files. |
| `npm run test:built-api` | Passed HTTP health, missing-token rejection, private-worker route separation and CORS. No live integration. |
| `npm run review:web` | Three fresh production-build Chromium loads passed; no browser errors or editor/cloud requests. |
| Visual / keyboard review | 390/768/1280/1440 widths and 720 x 450 zoom-equivalent reflow; no horizontal page overflow. Dialog/help/route focus and guarded navigation passed. |

The new public scenarios verify core computed color pairs, focus indication, reduced motion, all four widths, zoom-equivalent reflow, cancelled/accepted browser Back, preserved forward history, playground loss warnings and route refresh. Expanded emulator scenarios verify project-dialog Tab/Escape/return, import focus, help dismissal, saved draft cancellation, back/forward to a saved project, tablet header containment, dashboard/source/video reflow, and no private MP4 request while Source is open. Existing ownership, immutable versions, independent playback, request replay, exact exports and failure recovery continue passing with real Firebase emulators and explicitly labeled provider fixtures.

Two initial emulator runs passed 39/40. Both failures were the new test looking up a control while the Video panel was intentionally hidden (first via role, then exact label text). A direct mounted-state locator fixed that assertion without changing its expected selection or request-count checks. The final full suite passed. Existing Java deprecated-Unsafe, emulator listener-count, Playwright color and Zod/Rollup annotation warnings remain visible. Emulators and the measurement server/browser closed cleanly.

### Measurements and limits

The built homepage transferred **86,032 bytes** including local HTTP overhead in each fresh context (document plus seven resources). FCP/LCP were **112/112, 100/100 and 100/100 ms**. This is unthrottled loopback measurement on Chromium 156.0.8078.4, not deployed latency or a performance score. Raw timings, resource sizes and build artifacts are archived in [performance JSON](ui-u6/performance.json).

Compared with U5, Homepage JS remains **18.25 kB / 5.64 kB gzip**. CanvasEditor JS is **80.91 / 24.01 kB** versus **80.55 / 23.79 kB**; its CSS is **20.47 / 4.25 kB** versus **20.38 / 4.24 kB**. App JS is **230.02 / 67.80 kB** versus **229.37 / 67.62 kB**. These increases contain navigation/accessibility/media guards; they are not loaded by the homepage. No before/after field-performance improvement is claimed.

The [contrast report](ui-u6/theme-contrast.json) covers core text/surface pairs, primary-button text and focus colors, not every rendered pixel. 200% was exercised through the equivalent CSS viewport; native browser zoom controls were not manually tested. Manual screen-reader use, Safari/Firefox/mobile-device testing and a full accessibility conformance audit remain unverified. Long video forms require vertical scrolling, and brand treatment differs between the public/dashboard and saved editor/playground surfaces.

Production authentication, billed Google analysis/video/edit, deployed IAM/privacy/worker checks, Docker and remote CI remain pending. No live output was simulated and no production deployment was attempted. The U1 external reference visual inspection remains open. All required cloud credentials and setup steps remain documented in [cloud setup](cloud-setup.md), [worker setup](video-worker-setup.md) and the [release checklist](release-checklist.md); U6 requires none beyond the existing local setup.

## U5 — generation, versions and timeline

Recorded October 13, 2026 (Pacific/Fiji). **Local U5 implementation and acceptance passed.** The Video workspace now leads with playback and parent comparison, with a source/plan/consent checklist alongside it. U6 accessibility, performance and release review is next.

### Changes and evidence

- Empty clips provide working drawing and shot-plan destinations. Generation requires explicit review of the current plan, ownership permission and paid consent; changing the plan invalidates its review. Detailed prompts and service information are expandable.
- Activity exposes queued, generating/storing, completed and failed server states and each request's saved source revision. Drawing can continue after submission. Existing request IDs, safe replay and immutable versions are preserved; no automatic paid retries or invented progress indicators.
- Independent parent/revised players lead the review area. Comparison can be hidden and pauses the parent. Version cards and the native selector distinguish preview from saved scene selection. Prompt/provenance history and original selection remain accessible.
- The preview timeline has real playback controls, a keyboard-accessible playhead, trim bounds and caption bands. Exact fields and validation remain. MP4 and current timeline JSON downloads clearly describe their different contents; captions and trim are not encoded into the MP4.
- [Video workspace behavior/setup](video-workspace.md), [ten actual captures](ui-u5/README.md), roadmap and provenance updated. No new dependency, credential, cloud service or API schema.

### Actual validation

| Command / check | Result |
| --- | --- |
| `npm.cmd run typecheck` | Passed shared/API/web and tooling, including browser tests. |
| `npm.cmd run lint` | Passed. |
| `npm test` | 200 tests passed across 15 files. |
| `npm run test:e2e` | Nine tests passed in 15.8 seconds. |
| `npm run test:emulators` | Full suite: 40 tests passed in 2.0 minutes, zero retries. |
| Final video/capture check | The expanded video scenario also passed after the final visual adjustments: one test, 26.1 seconds including setup, using the same isolated test-profile Firebase emulators and Playwright configuration. |
| `npm run build` | Shared/API/web production build and browser artifact scan passed. |
| Visual review | Empty/queued/failed states, parent/revised playback at 1280px and 1440px, and comparison, exact fields and downloads at 390px reviewed. No phone page overflow. |

The expanded video scenario uses a real Fastify server, Auth, Firestore and private Storage emulators. Explicitly labeled repository MP4 fixtures supply the provider output. It loses only the acknowledgement after a real generation reservation and proves replay keeps the same ID and a single provider dispatch. It verifies subsequent drawing saves do not alter the queued source revision, both versions play, hiding comparison pauses the parent, previewing does not save selection, restoring does, timeline settings survive reload, keyboard seeking reaches trim bounds, MP4 bytes remain exact, JSON matches the saved settings, and failed edits preserve both clips and selection. No live Google output is claimed.

The first full emulator run passed 39/40: the new retry assertion inspected the request log before the asynchronous replay arrived. Waiting for that log corrected the test; the full rerun passed. Visual review then moved playback above the version controls, aligned consent checkboxes inline and removed a scroll artifact from the full-page capture. The final focused reruns passed. Existing Zod/Rollup annotation, Java deprecated-Unsafe, emulator listener-count and Playwright color warnings remain visible; emulators shut down cleanly.

The final production build emits CanvasEditor JS at 80.55 kB (23.79 kB gzip) and its scoped CSS at 20.38 kB (4.24 kB gzip). Homepage JS remains 18.25 kB (5.64 kB gzip); App JS is 229.37 kB (67.62 kB gzip). These are build artifact sizes, not measured page transfers or a performance score. The browser artifact scan passed across 17 files. Documentation links and `git diff --check` passed.

### Remaining gates and limits

Trim/captions remain browser preview metadata. There is no encoded timeline export, multiclip editing or new offline draft persistence. Production Firebase/Google sign-in, billing/IAM, paid Gemini analysis/video/edit, remote CI, Docker and deployment remain deferred and unverified. Existing [cloud setup](cloud-setup.md) and [release checklist](release-checklist.md) document the required credentials and console steps; U5 adds none. U1's external visual reference inspection remains open. The broader accessibility, zoom and performance review belongs to U6.

## U4 — saved source editor workspace

Recorded October 13, 2026 (Pacific/Fiji). **Local U4 implementation and acceptance passed.** Saved projects now open a canvas-centered Source workspace with tools/import/layers on the left and Properties or Shot plan on the right. Source/Video switching and the collapsible video panel preserve a single scene session. Compact screens use Canvas, Tools & layers and Inspector controls. U5 generation/version/timeline polish is next.

### Changes and evidence

- The unified project header keeps Back to projects, title, save state and manual save together. Global save recovery, analysis review and video activity/error notices stay reachable when panels are hidden.
- Contextual drawing, object, text and crop controls reuse the saved scene model. Layer selection, hide/lock and Raise/Lower remain explicit. Tool shortcuts and help are available; typing in fields does not trigger canvas shortcuts. Phone canvas controls have enlarged touch targets.
- The scene saver, history, Konva stage, assistant and video panels stay mounted across view changes. Zero-width resize observations are ignored. Closing video pauses playback; it does not reset consent, request IDs, versions or timeline edits. Existing paid confirmation, immutable clips and request replay logic are retained.
- Manual authoring precedes the optional Gemini request. Suggestions still require explicit Apply and a matching source revision. An incomplete plan remains local and visibly blocks saving the combined document.
- [Workspace behavior, state ownership and setup](editor-workspace.md), [ten actual captures](ui-u4/README.md), roadmap and asset provenance updated. No new dependency, credential, cloud service or API schema.

### Actual validation

| Command / check | Result |
| --- | --- |
| `npm.cmd run typecheck` | Passed shared/API/web and tooling, including browser tests. |
| `npm.cmd run lint` | Passed. |
| `npm test` | 200 tests passed across 15 files. |
| `npm run test:e2e` | Nine tests passed in 27.8 seconds. |
| `npm run test:emulators` | Full suite: 40 tests passed in 2.0 minutes, zero retries. |
| Final workspace/capture check | The workspace scenario additionally passed in isolation after the final scroll-containment fix: one test, 17.6 seconds including setup. Same test-profile Firebase emulators and Playwright configuration; no API success fabrication. |
| `npm run build` | Shared/API/web builds passed; browser artifact scan passed across 17 files. |
| Visual review | Desktop 1440/1280 and phone 390px source, tools, properties, incomplete draft and unavailable video reviewed. Captures retain the local Firebase warning. |

The workspace test uses a dedicated real Fastify instance plus actual Auth/Firestore/Storage emulators. It verifies immediate source entry, accessible layer reorder, canonical pointer coordinates at both desktop sizes and on the phone, keyboard undo/redo, text-field shortcut isolation, unsaved manual direction and notes across Source/Video, consent retention, no paid requests or repeated availability fetches, and exact saved/reloaded source. Existing scenarios continue checking image crop/import, private snapshots, review/Apply, failure and conflict recovery, video replay, separate versions, timeline settings and exact original MP4 bytes. The labeled provider fixtures are test evidence, not live Gemini evidence.

Validation caught errors in the new test setup: a scene variable shadowed the browser document type; canonical stroke assertions initially omitted the object's relative origin; a consent assertion ran after a reload; the isolated server used a different legitimate unavailable-AI message; and a populated textarea required an accessible textbox locator. These were corrected without weakening the persistence assertions. Initial emulator runs reported 38/40, then 39/40, then 39/40 before the full 40/40 pass. Visual review then found absolutely positioned hidden fieldset legends extending page scrolling beyond the inspector; a local positioning context and a vertical-overflow assertion fixed it. Captures now start at the page top so offscreen fixed skip links do not appear inside full-page screenshots.

Production output includes the lazy CanvasEditor JS at 69.32 kB (20.87 kB gzip), its scoped CSS at 10.40 kB (2.44 kB gzip), App JS at 229.35 kB (67.60 kB gzip) and App CSS at 47.58 kB (10.93 kB gzip). These are emitted build sizes, not measured navigation transfer totals or a performance score. Existing Zod/Rollup annotation, Java deprecated-Unsafe, emulator listener-count and Playwright color warnings remain visible. Test emulators shut down cleanly.

### Remaining gates and limits

U4 is a saved-editor migration; the separate unsaved playground remains available and regression-tested. Video generation/revisions retain their existing form layout until U5. Invalid local drafts still require completion/removal or export before they can be persisted; switching views is safe, but closing the page is not offline draft storage. The broader accessibility/performance/release review remains U6.

Production Firebase/Google sign-in, cloud IAM, paid Gemini analysis/video/edit, Docker, remote CI and deployment remain deferred and unverified. No credential is needed for the local UI work. The U1 external reference inspection remains open. Follow the existing [cloud setup](cloud-setup.md) and [release checklist](release-checklist.md) when ready; UI checks do not close those gates.

## U3 — project dashboard and onboarding

Recorded October 13, 2026 (Pacific/Fiji). **Local U3 implementation and acceptance passed.** `/projects` is now a dedicated workspace with account/project navigation, grid/list presentation, search/sort explicitly limited to loaded projects, contextual guidance and project action disclosures. New project creation opens the blank saved source editor immediately. U4's editor workspace is next.

### Changes and evidence

- `apps/web/src/dashboard/`: production dashboard, signed-out/restoring/loading/empty/populated/partial/error states, private card previews, shared U1 components and responsive styles. The old marketing/gallery block was removed from `App.tsx`.
- `App.tsx` and `ProjectDialog.tsx`: preserve a saved-project destination while signed out; protect guest sign-out with a warning; retain deletion confirmation; trap dialog focus and return it when possible. UI unavailable states remain truthful when Firebase is unconfigured.
- `CanvasEditor.tsx`, `snapshot.ts`, `api.ts`, API routes and repository: generate a small preview of settled saved source, publish a revision-bound private PNG through the authenticated API, lazily fetch previews near the viewport and clean up replaced/interrupted assets. Source JSON and generation contracts are unchanged. No new dependency or credential.
- [Dashboard behavior/setup](dashboard.md), [API contract](api.md), [architecture](architecture.md) and roadmap updated. [Ten actual browser captures](ui-u3/README.md) document signed-out desktop/phone, empty/create/grid/list/mobile, partial-page search, loading and network recovery. Thumbnails show an original rectangle actually drawn and saved in the editor, not AI output. Firebase's local emulator warning remains visible in captures.

### Actual validation

| Command / check | Result |
| --- | --- |
| `npm.cmd run typecheck` | Passed shared/API/web workspaces and tooling, including browser tests. |
| `npm.cmd run lint` | Passed. |
| `npm test` | 200 tests passed across 15 files. |
| `npm run test:e2e` | Nine tests passed in 31.7 seconds, including the new signed-out mobile/dashboard destination check. |
| `npm run test:emulators` | Final full rerun: 39 tests passed in 1.6 minutes, zero retries. |
| `npm run build` | Shared/API/web production builds passed; browser artifact scan passed across 16 files. |
| `npm run test:built-api` | Passed compiled HTTP health, missing-token rejection, private-worker separation and CORS. No live cloud/model request. |
| Visual review | Signed-out desktop/phone, saved grid/list/phone, creation dialog and error/recovery captures reviewed. Right-edge tooltip overflow corrected and checked in the final emulator run. |
| `git diff --check` | Passed. |

The dashboard browser scenario uses a dedicated real Fastify instance and actual Auth/Firestore/Storage emulators. It verifies creation into an empty editor, drawing/save/reload, a stored 480×270 preview, private/no-store delivery, anonymous and foreign-owner rejection, invalid image rejection, stale-revision rejection, rename, independent duplication, cancel/confirm deletion, grid/list, search across a real 25-item page boundary, sort, no gallery scene-JSON requests, guest sign-out cancellation/confirmation and removal of rendered projects after sign-out. Recovery tests additionally verify stale previews are hidden, old thumbnail cleanup retries and deletion during upload cannot publish a late preview. Existing analysis/video fixtures remain explicitly test-only; no successful Google output is fabricated.

The first typecheck found unused imports after extracting the gallery; these were removed. The first emulator run had 38 passes and one timeout: the new test waited for a sign-out click to finish before dismissing its native confirmation dialog. The handler now dismisses/accepts the dialog as it arrives. The corrected full run passed. Visual review then found a right-edge Refresh tooltip extending the document width; anchoring that tooltip inward and adding an overflow assertion produced another full 39-test pass. Thumbnail publication was also tightened during review so reference publication and ready state share one transaction, retaining interrupted-upload cleanup.

The final emitted App JS is 229.19 kB (67.54 kB gzip), App CSS 47.56 kB (10.92 kB gzip), shared entry JS 224.34 kB (70.19 kB gzip), with separate shared primitive and lazy editor/Konva chunks. These are build sizes, not measured navigation transfer totals or a performance score. No new package was installed. Existing Rollup/Zod, Java deprecated-Unsafe, emulator listener-count and Playwright color warnings remain visible; no warning was suppressed. Test-profile emulators shut down cleanly.

### Remaining gates and limits

No U3 cloud credential is needed locally. Preview storage reuses the existing private bucket, API identity and cleanup schedule; deploy the API routes before the frontend when cloud setup is ready. Blank/older/duplicated projects have no preview until a nonempty saved source is opened and its thumbnail finishes. Preview failures are optional and never turn a saved scene into a failed save. Search/sort/view state and dismissed guidance are local to the dashboard visit; searching the entire unloaded repository is not claimed.

Production Google sign-in/revoked-session verification, cloud IAM, paid Gemini analysis/video/edit output, Docker, remote CI and deployment remain deferred and unverified. The U1 external Artcraft inspection remains open. U4/U5 will redesign the editor and generation surfaces; U6 still owns the broad accessibility/performance audit. See the [release checklist](release-checklist.md) for live gates.

## U2 — public homepage

Recorded October 13, 2026 (Pacific/Fiji). **Local implementation and U2 acceptance passed.** The public `/` route now has its own responsive page and loading boundary. U3's project dashboard is next; application screens retain their existing workflows.

### Changes and evidence

- Original-art hero, real navigation anchors, four workflow steps, alternating feature demonstrations, artwork showcase, creator-control information, six FAQs and opening/closing calls to action.
- Open studio reaches `/projects`; Try drawing opens `/studio/preview` before any generation. The application brand returns home through the existing leave guard. Configured Firebase entry was tested through real local Auth/Firestore/Storage emulators; the unconfigured entry retains its unavailable state and working playground.
- Local vector layer visibility, a manually authored shot-direction field and palette comparison provide working demonstrations. Each is labeled; none calls a model, saves a project or represents generated video. Current AI availability and original-MP4 export limitations are explicit.
- Root loading excludes Firebase, the application and Konva. `main.tsx` selects the entry; application CSS loads with `App.tsx`. The development-only design lab reuses the original artwork from `ui/SceneArtwork.tsx`.
- Mobile navigation includes expanded/hidden states and Escape focus restoration; FAQs are native disclosures. There is no autoplay. Reduced motion, focus and overflow checks cover the homepage's interactions.
- Original favicon, editable social SVG, exported 1200×630 PNG, title/description and social metadata. No dependency added. Known-origin metadata and deployment verification are documented in [homepage details](homepage.md) and the [release checklist](release-checklist.md).
- [Nine unmodified browser captures](ui-u2/README.md) record desktop/tablet/phone layouts and product/showcase/FAQ sections. Visual review covered the hero at all three sizes, product examples, showcase, FAQ, full phone layout and exported social card. [Asset provenance](ui-assets.json) distinguishes these illustrations from AI output.

### Actual validation

| Command / check | Result |
| --- | --- |
| `npm run typecheck` | Passed all workspaces and tooling; invoked with `npm.cmd` in the restricted PowerShell shell. |
| `npm run lint` | Passed; final invocation used `npm.cmd`. |
| `npm test` | 200 tests passed across 15 files. |
| `npm run test:e2e` | Eight tests passed in 23.9 seconds: three homepage tests plus five existing design/app tests. |
| `npm run test:emulators` | 36 tests passed in 1.6 minutes, zero retries, after the fixture fixes below. |
| `npm run build` | Shared/API/web builds passed; browser artifact scan passed across 15 files. |
| Production artifact inspection | Design-lab text markers absent. Homepage static imports resolve to the shared React/icon entry and two icon chunks, without a static App or Konva import. This is a bounded inspection, not a full performance/security audit. |
| Responsive/browser checks | 1440px, 768px and 390px widths; no document overflow, browser exceptions or Firebase/editor/private-service requests on root loading. Both CTA paths, local controls, metadata assets, mobile navigation and keyboard FAQ verified. |
| `node scripts/render-social-preview.mjs` | Exported 1200×630 PNG successfully; inspected the actual export. Fontconfig emitted cache-directory warnings in the restricted shell. |
| `git diff --check` | Passed. |

Vite reports the homepage-specific JS at 18.24 kB (5.64 kB gzip), homepage CSS at 20.39 kB (4.65 kB gzip), and the shared entry JS at 224.29 kB (70.17 kB gzip), with additional small icon chunks. These are emitted bundle sizes, not total transfer measurements, Lighthouse scores or field-performance claims. The broad U6 performance/accessibility audit remains planned.

The first emulator run had **34 passes and two failures**. The new homepage scenario increased shared loopback traffic until the baseline network-recovery scenario encountered HTTP 429. Its rerun now uses a dedicated real Fastify instance against the same isolated Firebase emulators, retaining production rate limits. A video quota fixture used wall time and advanced across UTC midnight, legitimately resetting the daily allowance. It now starts at a fixed midday instant. Production quotas and API behavior were not changed; the full suite passed after these fixes. No successful API response or AI result was fabricated.

PowerShell initially blocked the `npm.ps1` wrapper for typecheck/lint; using `npm.cmd` ran the same scripts successfully without changing execution policy. Existing Zod/Rollup annotation, Java deprecated-Unsafe, emulator listener-count and Playwright color warnings remain visible. Test emulators shut down cleanly. The final check found no development server listening at `127.0.0.1:5173`; run `npm run dev:emulators` for the homepage plus saved local projects, or `npm run dev` with your existing configuration.

### Remaining gates

No cloud credentials were required for U2. Live Gemini analysis, video/edit output, cloud access, Docker, remote CI and deployment are still unverified. Once the real Hosting origin is known, set absolute canonical/OG URLs and verify deployed previews; no public domain has been invented. The previous U1 external Artcraft visual-inspection blocker remains open. U2 does not claim to resolve it or to prove an exact visual match. Continue with U3 dashboard/onboarding, then U4/U5 editor and generation presentation.

## U1 — visual foundation and screen designs

Recorded October 13, 2026 (Pacific/Fiji). **Local implementation and acceptance checks passed. One external reference-inspection task remains blocked.** The existing product homepage/dashboard/editor have not been replaced; their migration belongs to U2–U5.

Open [the design lab](http://127.0.0.1:5173/design) while the development server is running. The existing local server returned HTTP 200 for this route. The lab contains desktop/mobile homepage, dashboard and editor compositions plus an interactive component catalogue. It is development-only and uses explicitly labeled local samples, with no Firebase or AI request. The real drawing playground remains accessible from the studies.

### Changes and evidence

- `apps/web/src/ui/`: scoped design tokens and reusable buttons, icon buttons/tooltips, fields, view switches, modal, disclosure actions, badges, notices, loading and empty states.
- `apps/web/src/design/`: original observatory vector artwork, three screen studies, component catalogue and separate marketing/dashboard/editor layout styles. A blank source canvas is the default editor state; no clip is required.
- `apps/web/src/main.tsx`: development-only design entry; the normal app is imported for existing routes. The design lab does not initialize the Firebase application.
- `tests/e2e/design.spec.ts`: responsive render/no-service-request checks, keyboard/dialog/menu/tooltip behavior and source-before-video navigation.
- `tests/e2e/ui-baseline.emulator.spec.ts` and additional canvas-test screenshots: actual existing-app states, including delayed real reads, deliberate network failure and successful recovery. No successful response is fabricated.
- [Visual system](ui-design-system.md), [asset manifest](ui-assets.json), [screenshot catalog](ui-u1/README.md), README and roadmap updates provide the implementation/review handoff. No dependency was added.

Reviewed desktop/mobile studies for hierarchy, artwork framing, source-first entry, controls and horizontal overflow. The final artwork uses a crop-safe label; primary links use dark ink on lavender. The design lab makes prototype scope visible. Baselines show the current long editor layout, small controls, generic gallery previews and mixed marketing/dashboard page so subsequent migrations have concrete comparison evidence.

### Actual validation

| Command / check | Result |
| --- | --- |
| `npm run typecheck` | Passed all workspaces and tooling, including new browser tests. |
| `npm run lint` | Passed. |
| `npm test` | 200 tests passed across 15 files. |
| `npm run build` | Passed shared/API/web builds and bounded browser-artifact scan (seven files). |
| `npm run test:e2e` | Five tests passed, including three new design tests and the existing two app smoke tests. |
| `npm run test:emulators` | 35 tests passed, zero retries. Actual Auth/Firestore/Storage persistence, ownership, recovery and labeled-provider-fixture revision coverage remain passing. |
| Production artifact inspection | Design-study text and CSS markers absent from emitted JS/CSS. This supports development-only exclusion, not a comprehensive security audit. |
| Layout inspection | Browser tests and screenshots at 1440px and 390px; no horizontal document overflow in the four preview views. |
| Color calculation | Main text/background 16.59:1; muted text/raised surface 7.56:1; primary action ink/fill 10.54:1; error text/error surface 9.04:1. These sampled opaque pairs are not a complete accessibility audit. |

The first typecheck caught an unused icon import. The first browser run found text damaged by a Windows encoding conversion and modal Tab focus escaping to browser chrome; both were repaired. The successful reruns above are the recorded final behavior. Visual review additionally corrected artwork letterboxing, primary-link text contrast and artwork-label cropping.

Known existing tooling warnings remain visible: Rollup annotations from Zod, Java 25 deprecated `Unsafe`, emulator-test `PassThrough` listener counts and Playwright color-variable warnings. No warning was suppressed. The test profile shut down its own emulators; existing development services were preserved. Remote CI, Docker, deployment and live Google output were not run or verified in this UI milestone.

### Remaining work

The external browser tool returned `Browser is not available: iab`; discovery returned no browsers. Artcraft's desktop/mobile appearance, media behavior and motion therefore remain **uninspected**. Only its earlier page-content/hierarchy review informs the reference notes; no exact visual match is claimed. The corresponding U1 checklist item stays open.

The studies are reviewable design implementations, not saved-project workflows. Their fields, sample cards and layer selections remain local. Complete the public landing page in U2, wire dashboard/editor migration in U3–U5, then perform the broader accessibility/performance audit in U6. The narrow-screen editor study stacks properties/layers; production drawer/state integration still belongs to U4. No cloud credential is required for these local UI milestones. Existing Firebase/Gemini deployment and real-output gates remain deferred as documented in [the release checklist](release-checklist.md).
