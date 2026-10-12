# UI upgrade results

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
