# U4 saved workspace evidence

Actual local Chromium captures, October 13, 2026 (Pacific/Fiji). These show original geometric source objects edited through AniForge and stored in Firebase emulators. No image is a Google-generated result or deployment evidence. Firebase's emulator warning is retained.

- [Empty source, 1440px](workspace-empty-1440.png).
- [Selected source objects, 1440px](workspace-source-1440.png) and [drawing at 1280px](workspace-source-1280.png).
- [Unsaved manual plan with visible recovery](workspace-local-draft.png).
- [Phone canvas](workspace-mobile-canvas.png), [tools and layers](workspace-mobile-tools.png), [text properties](workspace-mobile-properties.png) and [unavailable video](workspace-mobile-video.png).
- [Reloaded image crop and drawing](source-crop-after-reload.png) and [recoverable save conflict](source-save-conflict.png).

Regenerate with `npm run test:emulators`. The workspace scenario captures both desktop sizes and a 390 × 844 phone viewport. The existing canvas scenario provides crop/reload/conflict evidence. Original captures are under `test-results/emulators/e2e-workspace.emulator-*/` and `e2e-canvas.emulator-*/`; the archived PNGs are unmodified copies.

The workspace test uses its own real Fastify instance and actual Auth, Firestore and Storage emulators. Its AI services are unconfigured, so status/error messages are expected and drawing/manual plans remain available. Separately labeled analysis/video fixture tests prove UI request/review/version behavior only; they do not satisfy the live Google release gate.

See [workspace behavior and setup](../editor-workspace.md) and [actual validation results](../ui-upgrade-results.md).
