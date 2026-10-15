# Google AI model verification and smoke tests

Verified official model documentation on **October 13, 2026**, with analysis, billing and Omni documentation rechecked October 15. **Real analysis and initial video generation passed on October 15 with the replacement server key.** The owner also confirmed that the deployed analysis worked and the suggestion was applied. A real 4.01-second, 720p Omni MP4 played to completion and was recovered through the deployed worker into private storage. Conversational edits and the fresh signed-in video-generation flow still need verification; browser regression tests use explicitly labeled local fixtures.

## October 15 video activation

One bounded `gemini-omni-1.1-flash` request returned a 1,906,656-byte MP4 in 40,886 ms. Local browser playback reached the end without error at 1280 × 720 with 96 decoded frames. The deployed queue/worker then recovered that exact existing provider file, stored matching bytes privately and published one immutable version; anonymous GCS access returned 403. This recovery test did not issue another paid generation. Duplicate task delivery preserved the same single version. Read the [video activation evidence and credentials record](video-activation-results.md) for output locations, model/provenance limits, live revisions, service-account grants and remaining acceptance checks.

Video is enabled on API revision `aniforge-api-00008-kxk` and private worker `aniforge-worker-00003-h7g`; scheduled outbox recovery is verified. Typecheck, lint, 208 unit tests, release build and the 32-file browser artifact scan passed again. No additional source-code changes were needed. A separate recurring media-deletion schedule remains deferred at the owner's request.

## October 15 replacement-key verification

### Application regression found after the provider smoke

The owner's production request `req-1h` returned HTTP 502 / `AI_BAD_ANALYSIS` on revision `aniforge-api-00006-ldz`. Although the provider smoke passed, `SceneAnalysisService` still rejected a null interaction ID. The provider fix had missed this second validation boundary. An API regression test reproduced the rejection (expected 200, received 502) before the service check was corrected.

The service now accepts an explicit null ID while still validating the shot plan, model and any supplied ID. Unit coverage checks both stored and stateless IDs and rejects empty/oversized supplied IDs. The browser emulator flow now uses a stateless provider fixture and verifies a succeeded Firestore record with `interactionId: null`, review/apply, saving, reload, and preservation of the drawing and previous plan after a later failure. These fixtures are local regression evidence, not live Google output. No additional paid model request was made for this correction.

Verification after the correction: typecheck, lint, **208 unit tests**, **40 browser/integration emulator tests**, release build and 32-file browser artifact scan passed. Emulator dependency warnings (Java `Unsafe`, stream listener counts and color settings) and existing Zod build annotation warnings were non-blocking. The owner subsequently confirmed live analysis worked and applied the suggestion. The prior failed record was not modified.

Previously failed analysis IDs retain their recorded failure to prevent duplicate paid dispatch. After deployment, start a new request with **Analyze scene**; **Retry same analysis** retrieves the earlier error. The discarded provider response for `req-1h` was not recovered or represented as a successful plan.

### Earlier real provider result

The owner supplied a key from a separately funded AI project, reporting $5 prepaid and $50 eligible credits on billing account `012543-C8DA4D-4D9D32`. A successful real request verifies analysis access, not the remaining credit balance or video entitlement. Firebase, Cloud Run and private media remain in `aniforge-511502`; changing the Gemini key does not require migrating these resources.

The first new-key requests completed at Google but exposed an adapter bug: stateless analysis (`store=false`) returned no interaction ID. The adapter now accepts an absent analysis ID and records `null`; stored video interactions still require an ID. A captured real response passed local replay validation, followed by a fresh CLI request with a 40-second deadline that exited 0 and saved `artifacts/ai-smoke/analysis-2026-10-15T02-38-46-517Z-8219a0ec-e3e3-44db-886c-42f83b931cef/analysis.json`. Input: the repository's original `apps/web/public/artwork/sky-artist.webp`, with ownership affirmation. Artifacts are Git-ignored. No fake result or replacement interaction ID was used.

Typecheck, lint, all **205 tests in 15 files**, and `npm run build:release` passed at that earlier checkpoint. The browser artifact scan passed for 32 files. Existing Zod annotation warnings are non-blocking. Browser/emulator tests were not rerun then; a local provider smoke does not prove authenticated production persistence. Deployment evidence is tracked in [cloud setup progress](cloud-setup-progress.md). Local analysis opt-in was enabled then; video activation followed as recorded above.

## Earlier October 15 activation check (superseded by replacement-key success)

The owner authorized AI activation after adding partner credits. The ignored server environment contains an API key; a read-only lookup of `gemini-3.8-flash` returned HTTP 200. An analysis smoke attempt using the repository's original `sky-artist.webp` failed with the previous generic error. One bounded diagnostic request recorded only the underlying SDK error type and HTTP status: `APIError`, 402. Neither attempt produced output. No video/edit request was sent. Paid opt-in was scoped to these test processes; persistent AI switches remain false pending billing verification.

Added safe `AI_BILLING_REQUIRED` handling for HTTP 402, no automatic retries, and a definitive failed-analysis record instead of an uncertain network outcome. Typecheck, lint, all 203 unit tests and the release build/32-file artifact scan passed. Browser/emulator suites were not rerun for this server error-mapping change. Existing Zod annotation warnings remain. This code change has not been deployed.

The next required check is **Google AI Studio > Billing**, for the project associated with the existing key: confirm the linked billing account, plan, account status and usable balance. Partner credits alone do not establish eligibility or a usable Gemini balance. Google's [billing guide](https://ai.google.dev/gemini-api/docs/billing#cloud-credits) states that Prepay accounts require an active prepaid balance before eligible Cloud credits can be consumed. The precise account billing condition is not observable from the HTTP 402 status alone.

After billing is resolved, rerun analysis and retain its schema-validated output. Then bind a numbered Secret Manager version as `GEMINI_API_KEY` on Cloud Run, grant that secret's accessor permission to the runtime identity and enable `ENABLE_REAL_AI=true`. Video remains a separate gate requiring paid model verification and the private worker/queue/recovery setup in [the worker runbook](video-worker-setup.md).

## Verified interface

- The [Omni model card](https://ai.google.dev/gemini-api/docs/models/gemini-omni-flash) names stable `gemini-omni-1.1-flash`, image/text inputs, and video output.
- The [Omni guide](https://ai.google.dev/gemini-api/docs/omni) documents `interactions.create` with image `data`/`mime_type` plus text; conversational edits use `previous_interaction_id`. `store=true` preserves conversation state. URI delivery uses `response_format.delivery='uri'`; the returned file must reach `ACTIVE` before download. Responses expose SDK `output_video` or REST `steps` video content.
- [Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output) documents Interactions JSON responses using `response_format: {type:'text', mime_type:'application/json', schema}`. Its example model is `gemini-3.8-flash`, the configurable analysis default here. Responses are still parsed and validated with our shared Zod shot-plan schema.
- [Image understanding](https://ai.google.dev/gemini-api/docs/image-understanding#passing-inline-image-data) documents an Interactions image part with base64 `data` and `mime_type`, alongside text. Phase 3 uses this server-side request format for the saved-scene snapshot and creator notes.
- [Pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-omni-flash) lists Omni on the paid tier; verify actual project pricing and quota before enabling it.
- [Interaction retention](https://ai.google.dev/gemini-api/docs/interactions-overview#data-storage-and-retention) is finite. Preserve generated files independently; a stored interaction ID does not promise permanent edit access.
- The [Omni uploaded-video edit example](https://ai.google.dev/gemini-api/docs/omni#edit_your_own_videos) uploads a video with the Files API, waits for processing, then sends `{type:'video', uri}` with a text prompt. Phase 5 implements this as an explicitly selected stored-video edit. It never silently issues another paid create after an unsuccessful conversational edit.

This implementation does not replace Omni with Veo. It does not invent a duration parameter: desired duration belongs in the prompt, and actual length must be checked in playback. No clip duration is claimed from the request alone.

## Required credentials and configuration

1. Create/select a Google AI Studio API project with billing enabled and access to the configured analysis model. Analysis does not require Omni video entitlement. Video/edit smoke runs additionally require paid Omni access in the applicable region. Review quotas and set a Cloud Billing budget alert.
2. Create a server API key. Put it in the ignored `apps/api/.env` for local work; use Secret Manager for Cloud Run. Never place it in a `VITE_*` variable or a committed file. See [cloud setup](cloud-setup.md) for cloud identities and deployment.
3. Choose an original image you own or have permission to process. The CLI requires an explicit `--attest-original` affirmation for every run, including edits.
4. Set these values locally. `ENABLE_REAL_AI=true` explicitly enables billable calls; do not enable it until billing and entitlement are confirmed.

```dotenv
ENABLE_REAL_AI=true
GEMINI_API_KEY=your-server-only-key
GEMINI_ANALYSIS_MODEL=gemini-3.8-flash
ANALYSIS_TIMEOUT_MS=40000
GEMINI_VIDEO_MODEL=gemini-omni-1.1-flash
AI_TIMEOUT_MS=300000
```

The API workspace scripts load `.env` with Node's `--env-file-if-exists`. Existing process environment variables take precedence. Firebase credentials are not required for these local provider tests; app persistence and deployment require the separate cloud setup.

The application analysis route reads `ANALYSIS_TIMEOUT_MS` independently of video configuration: default 40000, allowed 1000–45000 milliseconds. `GEMINI_VIDEO_MODEL` and the CLI's longer `AI_TIMEOUT_MS` cannot extend its synchronous deadline. This leaves time for the HTTP response before the browser/Hosting deadline. A slow model returns an explicit timeout instead of falling back to a sample plan. The standalone smoke commands retain their existing `AI_TIMEOUT_MS` deadline.

Analysis sends `store=false`, so Google may omit its interaction ID; the server records `null` when absent. An ID, when supplied, is provenance metadata, not a retained conversation for a later video edit. The prompt separates visible observations from proposed motion, quotes creator notes as data, and asks for uncertainties. Schema validation checks structure and bounds; it cannot prove that a model understood the drawing correctly. Review and edit the plan before generating a clip.

## Run from repository root (PowerShell)

Install dependencies and build the shared package first with `npm ci` and `npm run build`. Supply absolute image paths because npm workspace scripts run inside `apps/api`.

```powershell
npm run smoke:analysis -- --image 'C:\Art\my-original-sketch.png' --attest-original --notes 'Preserve the original pose and clothing.'
npm run smoke:video -- --image 'C:\Art\my-original-sketch.png' --attest-original --prompt 'Create a 6-second original 2D anime animation in one continuous shot. The adult traveler waves once; leaves move gently. Preserve the reference design and green jacket. No scene cuts.'
```

Each run writes a unique directory under ignored `apps/api/artifacts/ai-smoke/`. Analysis writes validated `analysis.json`; a successful video writes `video.mp4` and `metadata.json`. Metadata stores the model, interaction ID, prompt, and parent interaction ID. The console prints safe status and the output directory, never the API key or provider media URLs.

Read the successful video's `metadata.json`, then use its `interactionId` for the edit:

```powershell
npm run smoke:edit -- --interaction-id 'ID_FROM_METADATA' --attest-original --prompt 'Increase the breeze slightly. Preserve the character, clothing, framing, and waving action.'
```

The edit produces a separate directory and never overwrites the original. Use `--output-dir 'C:\path\to\private-output'` to change the output location. Keep metadata and original content private.

## App editing paths and required Google setup

The normal app edit uses the selected version's server-only interaction ID as `previous_interaction_id`. The worker requests a new stored interaction with URI delivery, saves the returned output-file checkpoint before download, and publishes a separate immutable MP4. An unavailable conversation returns an actionable error; it does not trigger an automatic upload or second billable request. Retention is configurable for paid projects, so even a previously valid ID can expire. [Google's interaction retention documentation](https://ai.google.dev/gemini-api/docs/interactions-overview#data-storage-and-retention) describes the available windows.

The user can instead explicitly choose the stored-video path, affirm ownership and authorize the new paid edit. The worker loads the selected private MP4 and uploads it through Google's [Files API](https://ai.google.dev/gemini-api/docs/files), using the same server API key already required for Omni. No public GCS URL, browser API key, new Google credential, or new IAM role is required. Upload session URLs are restricted to Google's API origin; the API key is sent only when creating the session. Polling, upload and model creation share one bounded deadline. Output-file checkpoints resume downloads without recreating an edit.

Google currently limits uploaded edit inputs to **10 seconds** and does not offer uploaded-video editing in the EEA, Switzerland or the UK. Voice editing is unsupported. Confirm account entitlement and region before selecting this path; see [Omni limitations](https://ai.google.dev/gemini-api/docs/omni#limitations). The provider checks the stored MP4's movie-header duration before uploading and refuses missing, invalid, zero or over-limit duration metadata. This header check is not decoding or a playback guarantee. Local trim controls affect preview; they do not shorten the MP4 uploaded to Google.

Temporary uploaded input files are deleted on a best-effort basis after a known completed interaction, or a pre-dispatch failure when a valid file name is available. After an ambiguous paid create/timeout, the input is left intact so an in-flight operation can finish; the [Files API](https://ai.google.dev/gemini-api/docs/files#delete_uploaded_files) expires uploads after 48 hours. Worker termination, timeout or cleanup failure can also leave a file until that expiry. Generated output files are kept long enough for durable download recovery; the app's private GCS copies remain independently stored until project deletion.

To verify the real Phase 5 gate, finish [worker setup](video-worker-setup.md), generate a genuine initial clip, submit a conversational edit and compare the two stored/playable versions. Then intentionally select the stored-video path for a clip at most 10 seconds and verify a distinct new provider interaction and new MP4. A failed edit must preserve the existing selection and old media. Confirm actual playback, visible requested change and ownership-protected download; fixture tests alone do not establish these results.

## What counts as proof

A command exits 0 only after a real Google response has been validated and its output written. A video must contain an MP4 `ftyp` header and be within 100 MiB; this is a container check, **not** a codec/playback guarantee. Play both MP4s locally and record their actual duration, visible change, model, and distinct interaction IDs before marking the generation/edit acceptance gates complete. No unit-test fixture counts as real-model evidence.

Current real-model results: **analysis and initial video passed on October 15, 2026 with the replacement key**. Edit smoke tests remain unverified. The initial MP4 also passed deployed checkpoint recovery/private storage checks. A fresh authenticated browser generation, reload/playback and follow-up edit remain separate acceptance steps in [the worker runbook](video-worker-setup.md).

Local verification on October 12, 2026: API TypeScript checking and provider ESLint passed; provider and HTTP transport suites passed **39 tests using mocked responses** on `@google/genai` 2.28.0. The HTTP tests exercise the installed SDK's documented response conversion and verify that signed download redirects do not receive API credentials. A regression test ensures an earlier conversation's video cannot count as a successful new edit. All three CLI commands were run without credentials and each exited 1 with `REAL_AI_DISABLED`, as required. Vitest/tsx initially hit Windows sandbox filesystem/account-lookup errors; the same commands ran successfully outside that sandbox after approval. These are disabled-mode and unit-test results, not real Google model results.

Phase 3 provider verification on October 12, 2026: the focused provider/configuration/HTTP suites now pass **50 tests**, API TypeScript checking passes, and provider ESLint passes. Added coverage checks the analysis-only configuration, bounded analysis deadline including rate-limit backoff, creator-note framing, and the installed SDK's actual HTTP request/structured-response conversion. HTTP is intercepted in these tests; no Google request is sent. A credential-presence check found no `apps/api/.env`, no process API key, and no real-AI opt-in. **Real-model analysis remains unverified until credentials, billing opt-in, and an original input are supplied.** See the phase report for application and emulator checks.

Phase 5 provider verification on October 13, 2026: the focused provider/configuration/HTTP suites passed **77 tests with mocked Google responses**; provider and transport ESLint passed. Coverage includes both installed-SDK edit request formats, new-interaction validation, checkpoint-before-download recovery, unavailable conversational context without automatic fallback, Files upload credential boundaries, duration rejection before upload, the locally recorded original MP4's duration, processing deadlines and safe temporary-file cleanup. The first Vitest attempt hit the Windows sandbox's esbuild access error; the approved run outside that sandbox passed. No live Google request or billable edit was made. The phase report records the full-repository and emulator checks separately.

## Failure handling

Missing opt-in/key/rights affirmation, invalid inputs, unavailable models, denied access, malformed analysis, absent MP4, rejected media URIs, and timeouts all produce safe JSON errors and exit 1. SDK errors are not printed verbatim because they can contain secrets or URLs. Downloads are bounded and only Google API media/approved Google redirects are accepted; the key is never forwarded to download redirects.

Explicit HTTP 429 rejections get at most two short backoff retries. Unknown outcomes, server errors, and timeouts are not automatically resubmitted: an earlier attempt might still complete and incur charges. Review AI Studio before requesting a new generation. File-processing polls share the operation deadline. Increase `AI_TIMEOUT_MS` (at most 1200000) only when needed for an intentional smoke run. A timeout does not cancel provider billing.

Unit tests inject a mocked transport and are explicitly test-only. Production and smoke construction always uses `@google/genai`; there is no fallback success, sample-video substitution, or hidden mock mode.
