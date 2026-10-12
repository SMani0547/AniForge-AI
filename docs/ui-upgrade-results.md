# UI upgrade results

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
