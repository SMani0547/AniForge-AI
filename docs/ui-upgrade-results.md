# UI upgrade results

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
