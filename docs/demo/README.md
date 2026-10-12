# Local evidence, not real Google output

`local-revisions-test-fixture.png` is captured by the automated revision browser test using real local Firebase services and two original, locally recorded geometric MP4 fixtures. Both clips are visibly marked **TEST FIXTURE — NOT AI OUTPUT**, and the model label is `TEST-FIXTURE-NOT-GOOGLE`. The image demonstrates the revision comparison, saved caption/trim controls and original-MP4 download UI. It is not proof of Gemini generation, deployed Firebase/Cloud Run, or real provider costs.

Regenerate with `npm run test:emulators`. The source screenshot is under `test-results/emulators/e2e-video.emulator-*/test-fixture-revision-comparison.png`. Review it before copying it here. The test also verifies actual independent playback, trim/caption behavior, reload persistence, exact download bytes and preservation after failure; a static screenshot alone cannot establish those behaviors.

For live evidence, capture original artwork/source, a real schema-valid analysis, a successful generation job, independently playable parent/revision and a protected download after deployment. Keep private IDs, prompts and credentials out of screenshots. Record actual dates, commit/image digest and the distinction between a live request and an earlier real result. See [release gates](../release-checklist.md).
