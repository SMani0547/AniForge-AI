# Google AI model verification and smoke tests

Verified official documentation on **October 12, 2026**. Documentation verification is not proof that this project's API key has access. **No real analysis, generation, or edit has been executed in this workspace: credentials and explicit paid opt-in are absent.** No MP4 has been generated.

## Verified interface

- The [Omni model card](https://ai.google.dev/gemini-api/docs/models/gemini-omni-flash) names stable `gemini-omni-1.1-flash`, image/text inputs, and video output.
- The [Omni guide](https://ai.google.dev/gemini-api/docs/omni) documents `interactions.create` with image `data`/`mime_type` plus text; conversational edits use `previous_interaction_id`. `store=true` preserves conversation state. URI delivery uses `response_format.delivery='uri'`; the returned file must reach `ACTIVE` before download. Responses expose SDK `output_video` or REST `steps` video content.
- [Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output) documents Interactions JSON responses using `response_format: {type:'text', mime_type:'application/json', schema}`. Its example model is `gemini-3.8-flash`, the configurable analysis default here. Responses are still parsed and validated with our shared Zod shot-plan schema.
- [Pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-omni-flash) lists Omni on the paid tier; verify actual project pricing and quota before enabling it.
- [Interaction retention](https://ai.google.dev/gemini-api/docs/interactions-overview#data-storage-and-retention) is finite. Preserve generated files independently; a stored interaction ID does not promise permanent edit access.

This implementation does not replace Omni with Veo. It does not invent a duration parameter: desired duration belongs in the prompt, and actual length must be checked in playback. No clip duration is claimed from the request alone.

## Required credentials and configuration

1. Create/select a Google AI Studio API project with billing enabled and paid Omni entitlement in the applicable region. Review quotas and set a Cloud Billing budget alert.
2. Create a server API key. Put it in the ignored `apps/api/.env` for local work; use Secret Manager for Cloud Run. Never place it in a `VITE_*` variable or a committed file. See [cloud setup](cloud-setup.md) for cloud identities and deployment.
3. Choose an original image you own or have permission to process. The CLI requires an explicit `--attest-original` affirmation for every run, including edits.
4. Set these values locally. `ENABLE_REAL_AI=true` explicitly enables billable calls; do not enable it until billing and entitlement are confirmed.

```dotenv
ENABLE_REAL_AI=true
GEMINI_API_KEY=your-server-only-key
GEMINI_ANALYSIS_MODEL=gemini-3.8-flash
GEMINI_VIDEO_MODEL=gemini-omni-1.1-flash
AI_TIMEOUT_MS=300000
```

The API workspace scripts load `.env` with Node's `--env-file-if-exists`. Existing process environment variables take precedence. Firebase credentials are not required for these local provider tests; app persistence and deployment require the separate cloud setup.

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

## What counts as proof

A command exits 0 only after a real Google response has been validated and its output written. A video must contain an MP4 `ftyp` header and be within 100 MiB; this is a container check, **not** a codec/playback guarantee. Play both MP4s locally and record their actual duration, visible change, model, and distinct interaction IDs before marking the generation/edit acceptance gates complete. No unit-test fixture counts as real-model evidence.

The current smoke result is **BLOCKED: no API key / paid opt-in / original input supplied**. The app's authenticated job queue, private GCS storage, playback, and immutable Firestore versions are later milestones; CLI files do not prove those app capabilities.

Local verification on October 12, 2026: API TypeScript checking and provider ESLint passed; provider and HTTP transport suites passed **39 tests using mocked responses** on `@google/genai` 2.28.0. The HTTP tests exercise the installed SDK's documented response conversion and verify that signed download redirects do not receive API credentials. A regression test ensures an earlier conversation's video cannot count as a successful new edit. All three CLI commands were run without credentials and each exited 1 with `REAL_AI_DISABLED`, as required. Vitest/tsx initially hit Windows sandbox filesystem/account-lookup errors; the same commands ran successfully outside that sandbox after approval. These are disabled-mode and unit-test results, not real Google model results.

## Failure handling

Missing opt-in/key/rights affirmation, invalid inputs, unavailable models, denied access, malformed analysis, absent MP4, rejected media URIs, and timeouts all produce safe JSON errors and exit 1. SDK errors are not printed verbatim because they can contain secrets or URLs. Downloads are bounded and only Google API media/approved Google redirects are accepted; the key is never forwarded to download redirects.

Explicit HTTP 429 rejections get at most two short backoff retries. Unknown outcomes, server errors, and timeouts are not automatically resubmitted: an earlier attempt might still complete and incur charges. Review AI Studio before requesting a new generation. File-processing polls share the operation deadline. Increase `AI_TIMEOUT_MS` (at most 1200000) only when needed for an intentional smoke run. A timeout does not cancel provider billing.

Unit tests inject a mocked transport and are explicitly test-only. Production and smoke construction always uses `@google/genai`; there is no fallback success, sample-video substitution, or hidden mock mode.
