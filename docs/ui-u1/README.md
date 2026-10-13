# U1 visual evidence

These images are local browser captures of AniForge on October 13, 2026 (Pacific/Fiji). New compositions are explicitly labeled design studies. They are not live Google results or deployed product screens.

## New visual foundation

- [Homepage desktop](home-1440.png) and [mobile](home-390.png).
- [Dashboard desktop](dashboard-1440.png) and [mobile](dashboard-390.png).
- [Blank source editor desktop](editor-1440.png) and [mobile](editor-390.png).
- [Component catalogue](components-1440.png) and [keyboard focus](keyboard-focus.png).
- [Editor with original sample artwork](editor-artwork.png).

Regenerate with `npm run test:e2e`. The `design.spec.ts` tests capture these under `test-results/unconfigured/`. Review the images before copying them here. The component tests additionally exercise focus containment/restoration, validation, disclosure menus and Escape behavior; a screenshot alone does not establish those interactions.

## Current application baseline

- [Homepage / signed-out gallery](baseline-homepage.png).
- [Empty project library](baseline-dashboard-empty.png) and [populated project library](baseline-dashboard-populated.png).
- [Loading](baseline-dashboard-loading.png) and [recoverable network error](baseline-dashboard-network-error.png).
- [Empty saved editor](baseline-editor-empty.png), [saved edited source](baseline-editor-populated.png) and [save-conflict recovery](baseline-editor-conflict.png).

The homepage baseline comes from `smoke.spec.ts`. The saved editor/library baselines come from `canvas.emulator.spec.ts`, using actual local Auth, Firestore and Storage with original geometric artwork. `ui-baseline.emulator.spec.ts` temporarily delays a genuine read and aborts a request to expose loading/error UI, then verifies successful recovery. No invented successful API response is supplied. Regenerate these with `npm run test:emulators`; raw artifacts remain in the ignored test-results directory.

The screenshot catalog is for review, not pixel-perfect regression locking. The production UI is still the baseline application until later migration phases. External Artcraft screenshot/visual review is pending because no browser connection was available.
