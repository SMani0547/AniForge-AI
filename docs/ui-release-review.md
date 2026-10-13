# UI release review (U6)

This review covers the local application and production build. It does not verify a deployed service, real Google output or full accessibility conformance.

## Navigation and accessibility

Application history entries now carry an index. Cancelling a guarded Back/Forward returns to the previous entry without pushing a replacement entry or deleting forward history. Internal navigation still uses the same unsaved-scene guard. The unsaved playground now warns before discarding a drawing, including browser refresh/close. Clearing or undoing all strokes removes that warning.

Main landmarks accept focus and route changes focus them without scrolling. App routes get distinct document titles. Project and image-import dialogs return focus to their trigger after closing; native dialogs keep their modal behavior. Project-dialog Tab cycling, Escape and focus return are browser-tested. Editor shortcut help now closes with Escape. Existing field names, pressed view states, accessible layer actions, exact crop/timeline inputs, status messages and error alerts remain in place.

The contrast check measures computed U1 theme colors: normal/muted/accent/error/success text against the three core surfaces, primary-button text and focus indicators. It is a bounded token check, not a full rendered-pixel contrast audit. Reduced motion and visible keyboard focus are checked. A screen-reader user review and cross-browser assistive-technology testing remain recommended before a public accessibility claim. Freehand drawing still uses a pointer; saved object selection, position, dimensions and layers have keyboard controls.

## Responsive review

Browser scenarios review 390, 768, 1280 and 1440 CSS-pixel widths. A 720 x 450 CSS viewport exercises the reflow corresponding to a 1440 x 900 browser at 200% zoom. This is a viewport-equivalent automated check, not a claim that OS/browser zoom controls were manually tested. Homepage, signed-out dashboard, playground, saved dashboard, Source and Video participate. Compact source panels are checked separately. Revision clips remain explicitly labeled fixtures.

The audit found and fixed a tablet header overlap: the saved editor's fixed desktop height overrode the wrapped navigation layout between 600 and 800px. The header now grows with its navigation; a bounds assertion protects it. Source editing remains usable without generation. Long video forms scroll vertically; there is no unintended horizontal page scrolling in the tested layouts.

## Loading and measurement

The homepage remains a separate entry from Firebase/the application and does not load Konva or editor code. Canvas and playground code are route-lazy. Dashboard previews retain intersection-based loading. Private MP4 retrieval now waits for the Video panel (and parent comparison) to be opened. Once activated, a player retains its object URL across view toggles; hiding it pauses playback without repeating paid work. Job metadata polling and request recovery remain mounted.

Run `npm run build` followed by `npm run review:web`. The new script serves the actual built artifact on loopback, creates three fresh Chromium contexts, records FCP/LCP/navigation timing and transferred resources, checks for unexpected editor/cloud requests and browser errors, then closes its browser/server. It writes `artifacts/ui-review/performance.json`. These unthrottled local measurements are neither Lighthouse scores nor deployed latency. Archive reviewed results under `docs/ui-u6/`; compare emitted bundle sizes separately from network transfers.

## Credentials and release gates

U6 adds no package dependency, credential, provider format or cloud service. Local UI work uses the existing emulator setup. All production credential, billing, IAM, private bucket, worker/queue and deployment steps remain in [cloud setup](cloud-setup.md), [worker setup](video-worker-setup.md) and the [release checklist](release-checklist.md).

The owner deferred cloud setup. Production sign-in, live analysis/video/edit, private-worker IAM, Docker/remote CI and deployed-user checks remain pending; UI evidence must not close them. The original external Artcraft visual reference inspection is also still pending. No production deploy or paid request is part of this review.

See [actual commands/results](ui-upgrade-results.md) and [reviewed screenshots and measurements](ui-u6/README.md).
