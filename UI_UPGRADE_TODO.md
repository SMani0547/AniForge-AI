# AniForge AI — UI upgrade roadmap

Created October 13, 2026 (Pacific/Fiji). Status: **U1 local visual foundation, U2 public homepage, U3 project dashboard, U4 source workspace and U5 video workspace implemented; external reference visual review pending. U6 local review passed; live cloud release remains deferred.** See [actual UI results](docs/ui-upgrade-results.md), `/`, `/projects` and the development-only `/design` preview.

## Brief

Give AniForge the polish and clarity of a professional creative application: a distinctive public homepage, a useful project dashboard and a focused editing workspace. The owner requested a substantial visual upgrade inspired by Artcraft, with the ease of use associated with Canva and Microsoft Clipchamp. This roadmap is separate from the backend/release milestones in [TODO.md](TODO.md).

The requested homepage is now in scope. Build it alongside the existing product workflow; retain the architecture and data contracts in [BUILD_PLAN.md](BUILD_PLAN.md). “Enterprise-grade” here means coherent visual design, predictable controls, accessible interactions and reliable feedback. Team workspaces, enterprise identity, subscriptions and collaboration require separate product/backend work.

## Reference and design direction

Reference reviewed: [Artcraft homepage](https://getartcraft.com/) on October 13, 2026. Its page structure includes a direct product introduction, prominent app entry, feature demonstrations, ownership messaging and a work showcase. Use those broad presentation patterns as inspiration. The initial reference review covered page content and hierarchy; desktop/mobile visual inspection remains a Phase U1 task.

Create an original AniForge identity, typography, copy and artwork. Suggested direction: an art-led dark homepage, large editorial headings, charcoal surfaces, warm white text, restrained electric blue/violet accents, generous spacing and a substantial product demonstration. The editor uses denser spacing and quieter surfaces so the artwork takes priority. Avoid filling every section with glowing cards, tiny gray text or decorative gradients.

Canva and Clipchamp are usability references requested by the owner, not promises of feature parity. Do not import Artcraft's feature list, subscription claims, desktop downloads or community films into AniForge.

## Target experience

| Surface | Route | Main purpose |
| --- | --- | --- |
| Public homepage | `/` | Explain the product through artwork and a clear journey; offer Open studio and Try drawing. |
| Project dashboard | `/projects` | Sign in when needed, create/open projects and resume existing work. |
| Saved editor | `/studio/:projectId` | Edit original source immediately; plan, generate and revise from the same workspace. |
| Drawing playground | `/studio/preview` | Try drawing without an account; clearly identify the unsaved session. |

The drawing editor must open **before** AI analysis or video generation. A new project starts with an editable blank scene. Video preview, trim, captions and revision tools become useful when a clip exists; their empty states explain the next action without blocking drawing. Missing Google credentials must not lock the source editor or manual shot planning.

## Current gaps to address

- U2 separated the public homepage from application loading; U3 replaced the mixed introduction/gallery with a dedicated project workspace.
- U3 adds private source thumbnails and scoped search/sort. Blank/older/duplicated scenes show an explicit empty preview until a saved source thumbnail is available.
- U4/U5 provide separate Source/Video workspaces. Long video forms still require vertical scrolling on compact screens.
- Most presentation lives in a large `styles.css`; reusable components and visual tokens need clear ownership.
- U6 updated playground availability copy. Public/dashboard and saved editor/playground branding still use different treatments.
- Existing persistence, private assets, job recovery and version behavior are valuable foundations. Presentation changes must preserve these working paths.

## Phase U1 — visual foundation and screen designs

- [ ] Inspect the Artcraft reference visually on desktop/mobile and record layout, typography, media and motion observations. Blocked in U1: the browser tool was unavailable and discovery returned no browsers. Content/hierarchy review is recorded; exact appearance/motion is not claimed.
- [x] Capture current homepage, dashboard and editor screenshots as a baseline, including empty/loading/error states. See [evidence](docs/ui-u1/README.md).
- [x] Design desktop homepage, project dashboard and editor compositions plus a mobile homepage and compact editor layout. Reviewable `/design` browser studies precede product migration; no sample state is persisted.
- [x] Establish color, typography, spacing, border, radius, shadow, focus and motion tokens. See [visual system](docs/ui-design-system.md).
- [x] Define buttons, icon buttons, fields, view switches, tooltips, menus, dialogs, badges, notices/toasts, skeletons and empty states with hover/focus/disabled/error behavior. View switches use native grouped buttons rather than claiming ARIA tab semantics.
- [x] Split new marketing, dashboard and editor layout styles; scope tokens and primitives. Legacy styles stay on current product routes until U2–U5 migration. No dependencies added.
- [x] Define [asset provenance](docs/ui-assets.json), including original vector artwork, brand study, existing Lucide icons and baseline/prototype screenshots. No genuine generated output is claimed.

**Acceptance:** three screen designs share one visual language; a UI component preview demonstrates keyboard focus and major states; source editing is an obvious entry point. No cloud access is needed.

The local design/interaction acceptance is met. The external reference review remains open above; subsequent phases have not been silently marked complete by prototype screenshots.

## Phase U2 — new public homepage

- [x] Give `/` a dedicated landing page and marketing navigation: Product, How it works, Examples, FAQ and Open studio. Every link must have a real destination; sections may use anchors.
- [x] Build a prominent hero with an original artwork/editor composition, a concise product promise, primary **Open studio** CTA to `/projects` and secondary **Try drawing** CTA to `/studio/preview`.
- [x] Draft headline direction: “Your sketch. Your story. In motion.” Support it with concrete source-editing, shot-planning and versioning language rather than unsupported speed/quality claims.
- [x] Show the workflow visually: Draw or import → Plan the shot → Generate a clip → Revise and compare. Make the first step usable without a generated scene.
- [x] Add alternating feature demonstrations for editable layers, reviewed shot plans and preserved video versions; use large product visuals with concise captions.
- [x] Add a showcase using rights-cleared original art. Label illustration/concept media accurately; publish “Made with AniForge” video only after genuine app generation is verified.
- [x] Add a compact creator-control section: editable source, separate video versions, authenticated project access and explicit paid generation consent. Avoid certifications, absolute security claims or unverified ownership/legal promises.
- [x] Add FAQ covering source vs video editing, account requirements, original artwork, paid generation and original-MP4 export limitations.
- [x] Finish with a strong closing CTA and a useful footer. Include only maintained links; do not invent pricing, testimonials, customer logos, adoption counts or availability claims.
- [x] Build responsive navigation, optimized poster images and optional user-controlled video. Respect reduced motion; avoid autoplay audio and scroll-jacking.
- [x] Add page title, description, favicon and an original social preview; set canonical/public URLs only when known. Keep private project content out of public metadata.
- [x] Show a clear current availability notice while live AI remains unverified. Move deployment instructions into documentation/development help, retaining useful in-product unavailable states.

**Acceptance:** `/` is a complete standalone homepage at phone, tablet and desktop sizes. Both CTAs work with configured and unconfigured Firebase. Landing-page loading does not fetch private projects or eagerly load Konva/the editor.

**Local acceptance met:** responsive homepage and both editor entry paths verified with and without Firebase configuration. Original vector examples are labeled; live AI remains unverified. Social URLs await the real deployment origin. See [implementation](docs/homepage.md), [results](docs/ui-upgrade-results.md) and [captures](docs/ui-u2/README.md).

## Phase U3 — project dashboard and onboarding

- [x] Separate the dashboard from marketing content; provide a compact application header, account menu, project navigation and a clear New project action.
- [x] Design coherent signed-out, restoring-session, empty-library, populated, loading, partial-pagination and failure states.
- [x] Simplify new-project creation and take the user into the saved source editor after success. Keep import/draw as immediately discoverable next actions.
- [x] Make cards useful: readable title, last edited time, scene count and consistent rename/duplicate/delete menus. Preserve delete confirmation and ownership checks.
- [x] Show actual scene thumbnails when available through authorized assets. Add a bounded thumbnail path if necessary, with private access tests; do not publish user media or fetch every full canvas for the gallery. Keep a deliberate empty preview until this works.
- [x] Offer grid/list presentation. Add search/sort only with honest scope: either explicitly search loaded projects or implement repository-wide query support and pagination; never silently hide unloaded matches.
- [x] Explain guest persistence and the unsaved playground clearly. Preserve return-to-project behavior after sign-in, sign-out and expired sessions.
- [x] Add brief first-project guidance and contextual help that can be dismissed. Avoid fictional Recent/Templates/Team destinations with no functionality.

**Acceptance:** a fresh local-emulator user can create, edit, reopen, rename, duplicate and delete a project without ambiguity. A returning user can find and resume work. No generation is required to enter the editor.

**Local acceptance met:** actual emulator CRUD, immediate editor entry, saved/reloaded source, private revision-bound thumbnails, grid/list, partial pagination and guarded guest sign-out are verified. See [dashboard details](docs/dashboard.md) and [results](docs/ui-upgrade-results.md). Production Google authentication and live release remain deferred.

## Phase U4 — professional source editor workspace

- [x] Introduce an editor shell: project/back navigation, title and save status across the top; import/drawing/layers on the left; large central canvas; contextual properties or AI assistant on the right; a collapsible video/timeline area below.
- [x] Use clearly named **Source** and **Video** views while preserving one scene/session. Opening Source never depends on clip availability.
- [x] Move tools into consistent groups with labels/tooltips, selected states and keyboard shortcuts. Keep shortcuts inactive in text inputs and expose them in help.
- [x] Improve fit-to-view, zoom, pan, selection and transform affordances. Preserve the canonical 1920×1080 document and pointer coordinate accuracy when panels resize.
- [x] Make layers easier to scan with selection, visibility, lock and ordering feedback; retain accessible reorder buttons alongside any optional drag interaction.
- [x] Replace always-visible property clutter with context-sensitive controls for drawing, text, shapes and image crop. Preserve all saved object properties.
- [x] Keep autosave/manual save, unsaved changes, failure and conflict recovery visible. Never discard drawing/plan/timeline edits when switching panels or views.
- [x] Reorganize shot planning as a useful assistant: manual authoring, Analyze, review suggestion and explicit Apply. Keep paid/request state and source-revision checks intact.
- [x] Support compact screens with switchable panels/drawers and touch-friendly controls. Avoid shrinking the full desktop workspace onto a phone.
- [x] Audit panel mounting/state ownership so tab changes do not reset unsaved data, start duplicate requests or hide recovery actions.

**Acceptance:** import/crop/draw/layers/undo/save/refresh still work. The canvas is the primary workspace at 1440×900 and 1280×800; critical controls remain reachable on a 390px-wide screen. Keyboard and pointer workflows both work.

**Local acceptance met:** real emulator source import/crop, drawing, layers, undo/redo, saved reload, conflict recovery, canonical coordinates at two desktop sizes and 390px controls pass. View switches preserve manual drafts, request state and video playback/recovery without automatic paid calls. See [workspace behavior](docs/editor-workspace.md), [captures](docs/ui-u4/README.md) and [results](docs/ui-upgrade-results.md). Live Google verification remains deferred.

## Phase U5 — generation, video revisions and timeline polish

- [x] Turn the generation form into a clear sequence: saved source, reviewed plan, request summary, permission/paid confirmation and Generate. Keep detailed prompts/provenance in expandable details.
- [x] Present queued/running/succeeded/failed states with honest status text, accessible announcements and safe recovery actions. Do not invent percentage completion or remaining-time estimates.
- [x] Allow ongoing source editing when the queued workflow permits it, while clearly identifying which saved source revision the job uses.
- [x] Create a useful empty video state with a path to plan/generate and a persistent return to drawing. When AI is unavailable, preserve manual editing and explain the limitation.
- [x] Give video playback a prominent stage and versions a readable strip/list. Show parent/revision, selected version and distinct actions for preview versus saved selection.
- [x] Improve side-by-side comparison, requested-change history and restore selection; keep originals immutable and both clips independently playable.
- [x] Present single-clip trim/caption preview as an intelligible timeline with a playhead and time fields. Keep keyboard-accessible exact inputs; do not imply multiclip/audio/encoded export exists.
- [x] Add a clear download panel: **Original MP4** and **Editable timeline JSON**. State that preview trim/captions are not baked into the MP4.
- [x] Preserve failed-edit recovery, request replay, ownership, paid consent and private media delivery. Never introduce automatic paid retries through UI lifecycle changes.

**Acceptance:** the fixture-backed emulator flow still proves generation state handling, independent versions, restore, saved preview settings and exact download bytes. Real Google generation remains a separate release gate.

**Local acceptance met:** reviewed-plan consent, lost-response replay, fixed queued source revisions, independent playback/comparison, preview versus saved selection, reloaded trim/captions, keyboard seeking, exact MP4/JSON downloads and failed-edit preservation pass with explicit test fixtures. Desktop and 390px phone layouts reviewed. See [video workspace](docs/video-workspace.md), [captures](docs/ui-u5/README.md) and [actual results](docs/ui-upgrade-results.md). Live Google verification remains deferred.

## Phase U6 — accessibility, performance and release review

- [x] Audit keyboard navigation, dialog focus/return, Escape behavior, labels, focus visibility and screen-reader announcements. Target WCAG AA contrast and respect reduced motion.
- [x] Review 390px, 768px, 1280px and 1440px viewports plus 200% zoom-equivalent reflow (720 x 450 CSS viewport on a 1440 x 900 baseline); fix clipped controls, unintended horizontal page scrolling and unreadable labels.
- [x] Verify route refresh, browser back/forward, direct project links, signed-out redirects and unsaved-change guards after the route split.
- [x] Capture/review homepage, dashboard, empty source editor, populated editor and revision screenshots. Document both strengths and remaining issues.
- [x] Measure production landing-page load and bundle changes. Lazy-load canvas/video UI, size images responsively and defer offscreen media; record measurements rather than claiming a performance score without a run.
- [x] Run appropriate interaction/browser tests for changed flows, preserving emulator ownership/persistence/recovery coverage. Avoid tests that merely assert CSS classes.
- [x] Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` after each implementation milestone; run `npm run test:e2e` and `npm run test:emulators` when routes or app interactions change, and both for final review.
- [x] Record actual commands, counts, screenshots, bundle measurements and blockers in `docs/ui-upgrade-results.md`; make a focused commit per implementation milestone.
- [ ] Run the existing release checklist when cloud setup is ready. **Deferred by the owner; live gates remain open.** Passing UI checks must not mark real Gemini, private-worker, container or deployed-user gates complete.

**Acceptance:** the redesign feels consistent across marketing and application screens, existing behavior passes regression checks and all advertised capabilities are accurately represented.

**Local acceptance met:** navigation/draft guards, dialog/help focus, core theme contrast, responsive layouts and deferred media pass. Built-homepage timing and bundle measurements are recorded. Native browser zoom controls and manual screen-reader/cross-browser reviews are not claimed. See [review scope](docs/ui-release-review.md), [evidence](docs/ui-u6/README.md) and [actual results](docs/ui-upgrade-results.md). Cloud credentials, real Google output and deployment remain separate pending gates.

## Execution order and dependencies

1. **Start with U1, then U2:** establish the visual system and replace the public homepage first, as requested.
2. **Continue U3 → U4 → U5:** upgrade the dashboard and editor in reviewable steps, keeping the app usable throughout.
3. **Finish U6:** consolidate visual evidence and regression results. Accessibility and responsive checks also apply during every earlier phase.

Local design, homepage work and emulator-backed application upgrades can proceed now without cloud credentials. Actual generation examples, deployed privacy verification and production release depend on the deferred setup in [docs/release-checklist.md](docs/release-checklist.md). Original showcase artwork may be created or supplied during U1/U2; no external asset or model-generated image should be represented as an AniForge output without provenance.

Later ideas, outside this redesign: teams/collaboration, billing, a template marketplace, multi-scene encoded exports, audio editing and advanced animation. Add these only through a separately scoped feature plan.
