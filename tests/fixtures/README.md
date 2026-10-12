# Original video fixture

`original-square-test-only.mp4` is a 320 × 180, two-second recording of an original moving blue square with a visible TEST FIXTURE label. It was created locally by `node scripts/create-video-fixture.mjs` using Chromium MediaRecorder. No Google AI call or third-party media is involved. It is used only by explicitly injected test providers and is never bundled into the application.

`revised-square-test-only.mp4` changes the original geometry's color to purple and adds upward motion, using `node scripts/create-video-fixture.mjs --edited`. It is a separate locally recorded test clip, not an AI edit. The browser tests use these distinct bytes to verify that edits preserve the original and that downloads match the chosen version.
