# U5 video workspace evidence

Actual local Chromium captures, October 13, 2026 (Pacific/Fiji). The geometric MP4s are repository-authored **TEST FIXTURE - NOT AI OUTPUT** clips used with real Firebase emulators and Fastify. They are not Google generation or deployment evidence. Firebase's emulator warning remains visible and can cross a long or element screenshot at the viewport edge.

- [Empty video workspace](video-empty.png) and [queued request with its saved source revision](video-queued.png).
- [Desktop review at 1280px](video-review-1280.png) and [1440px](video-review-1440.png).
- [Independent parent/revised comparison and playhead](video-comparison.png).
- [Full version, timeline, AI edit and download controls](test-fixture-revision-comparison.png).
- [Phone comparison](video-mobile-comparison.png), [exact trim/caption inputs](video-mobile-timeline.png) and [download choices](video-mobile-downloads.png), captured at a 390 x 844 viewport.
- [Failed edit with earlier completed clips preserved](video-failed-edit.png).

Regenerate through `npm run test:emulators`; the video browser scenario writes these names under `test-results/emulators/e2e-video.emulator-*/`. These archived PNGs are unmodified copies from the final isolated rerun of that same scenario and emulator configuration after playback was moved above the version controls.

The browser test verifies lost-acknowledgement replay with the same request ID, continuing source edits against a fixed queued revision, real media playback, parent comparison pausing, preview versus saved selection, reloaded trim/captions, keyboard seeking, exact original MP4 bytes, timeline JSON contents and failed-edit preservation. It asserts no page overflow at 390px. See [behavior and setup](../video-workspace.md) and [actual results](../ui-upgrade-results.md).
