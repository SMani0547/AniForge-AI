# AniForge AI — submission demo script

Prepared October 18, 2026. **Target runtime: 3 minutes 30 seconds.** The latest supplied rules require 3–4 minutes and a demonstration of working functionality. Use the actual studio for most of the recording, with a short architecture explanation near the end.

The supplied PDF labels its video field “3 Minutes”; the later instructions allow 3–4. This script follows the later instructions. A precise 3:00 cut plan is included below if the submission portal requires it.

Deck copy and submission links: [submission draft](../SUBMISSION_DRAFT.md).

## What is verified, and what to rehearse first

The owner confirmed live Gemini analysis. On October 15, a server-side Gemini video smoke test produced a real 4.01-second, 720p MP4. The actual deployed worker recovered that provider file into private Cloud Storage and published an immutable version. That is separate from a fresh signed-in browser generation. Live follow-up editing has not yet been verified. See [the evidence record](video-activation-results.md).

Before using the main narration, perform the corresponding actions successfully on the production site. Do not narrate a step as complete because its button exists. This document does not perform a new paid call.

Prepare one original, rights-cleared sketch and one saved project, such as **Sky Studio**. A suitable source already in the repository is [Sky Artist](../apps/web/public/artwork/sky-artist.webp). Use your own direction and show the result the model actually produces; do not promise that every detail will be preserved.

Suggested direction, to review before any paid request:

> A short, subtle animated moment. Gently move the hair and jacket with a light breeze and add a small stylus movement. Keep the character's design and clothing recognizable, with a steady camera and no new characters or lettering.

Complete these recording checks:

- Sign in to [the live app](https://aniforge.shivafj.dev/), open/create a project, change a source object, save, refresh and verify the change persists.
- Capture a real analysis response; review and apply it, then save the shot plan.
- Verify an actual app-generated clip, job completion, playback after reload and original MP4 download before using the main video segment below. Respect the configured paid-attempt limit; do not generate repeatedly just to retake narration.
- If showing a follow-up edit, verify two genuine versions and a visible result of the requested edit first. Keep the earlier clip playable.
- Close `.env`, cloud billing/account pages, tokens, raw provider metadata and unrelated personal tabs. Use a dedicated demo project with non-sensitive content.

## Main 3:30 script

Read the narration column only. Screen actions and timing labels are production instructions. Leave room for clicking, reading the shot plan and watching the clip; do not fill every pause with speech.

| Time | Screen and action | Narration |
| --- | --- | --- |
| **0:00–0:15** | Show the homepage briefly, then enter the studio. Keep the site address visible. | “This is AniForge AI, a browser studio for turning original artwork into short animated shots. It brings drawing, creative direction and AI video into one project, while keeping the creator's source editable.” |
| **0:15–0:35** | Show a genuine Google sign-in transition with private account details omitted, then the project library. Create or open **Sky Studio**. | “I sign in with Google and open my project library. Each project belongs to its creator. Let's open Sky Studio and take an original character sketch through the workflow, starting with the source.” |
| **0:35–1:05** | Import the original sketch if needed; affirm ownership. Select/move an object or add a small drawing stroke. Show layers, click **Save scene**, then refresh and reopen the same source. | “Here I can import my own artwork, draw on the canvas and adjust the objects in the scene. I'll make a small change, save it and refresh. The change is still here. AniForge stores editable scene data separately from media, so saving a video doesn't replace the drawing I started with.” |
| **1:05–1:40** | Open analysis, supply notes and required confirmations, and click **Analyze scene**. Show the actual suggestion. Review action/camera/preserve fields, choose **Apply suggestion to shot plan**, adjust if desired and save. Cut a wait only with a visible elapsed-time label. | “Next, Gemini analyzes the saved scene and suggests a shot plan. It describes the subjects, action, camera and visual details to preserve. I'm asking for gentle motion with a steady camera. The suggestion doesn't silently overwrite my work: I review it, apply it and save the direction I want. That gives the video request an explicit creative brief.” |
| **1:40–2:25** | In **Video**, review the prompt and paid/ownership confirmations, click **Generate animation**, and show the real job status. Cut to the actual completed result with “Generation wait shortened — actual elapsed: [measured time]”. Play the clip. Show only a successful production result for this narration; use the alternative below if unavailable. | “Now I review the video request and confirm generation. The app creates a job, while a private Cloud Run worker calls Gemini in the background. This recording shortens the waiting time; the completed clip is the actual result from this request. I can play it here and compare what happened with my direction. The editable source is still saved separately.” |
| **2:25–2:50** | Reload/open the saved video, play it again briefly, then show **Download original MP4** and **Download editable timeline JSON**. If demonstrating a caption/trim, visibly keep it in the preview. | “The saved clip is available when I reopen the project. I can download its original MP4 and keep timeline settings as a separate JSON file. Trim and captions are currently preview controls; they aren't baked into that MP4. The app keeps those editing choices separate from the generated video.” |
| **2:50–3:15** | Show the small architecture diagram from the prescribed deck, or a clean service diagram beside the running app. Avoid cloud-console navigation. | “Firebase Hosting serves the studio, and Firebase Authentication handles Google sign-in. Firestore stores projects, editable scenes, shot plans and job records. Cloud Run hosts the API and private worker, with Cloud Tasks dispatching video jobs. Gemini provides analysis and video generation through server-side calls, and Cloud Storage keeps the media private.” |
| **3:15–3:30** | Return to the studio and show the original sketch beside the actual clip if available. End with the product URL; use the verified repository/video links in the submission, not placeholder links on screen. | “AniForge brings the original drawing, reviewed direction and generated shot together. Next, we're validating live follow-up edits and extending video export. You can explore the deployed studio at aniforge dot shivafj dot dev.” |

The main narration is conditional on the actions succeeding during rehearsal. If you verify a real follow-up edit, use the segment below and update the closing sentence to reflect the actual remaining work.

## Optional verified-edit segment — replace 2:25–2:50

Use only after a real Google edit has completed and both original and edited clips play. Request a simple, visible change, such as slower movement, and judge whether the actual result supports that description.

**Screen:** show the original clip, the real instruction and **Create edited version**. Show a previously completed genuine edit or shorten the actual wait with a label. Play the parent and child, select the preferred version, and show the download controls. If using an earlier edit, say it was generated earlier.

**Narration:**

> “I also requested this change: [say the actual instruction]. This is the new version generated from that request. Here is the original, and here is the revision. The original remains available, so I can compare the results and choose which version to keep selected.”

Update the closing to: “Next, we're extending encoded export and measuring reliability across more creator scenes.” Use that wording only if the live edit validation is actually complete. Keep the full recording at 3:30 by replacing the default segment rather than adding time. State that MP4 export excludes preview trim/captions if those controls appear elsewhere.

## Honest alternatives for the generation segment

### A genuine clip was generated earlier through the app

Show the saved project and real clip. Replace “the actual result from this request” with:

> “To keep this demo short, I'm opening a clip generated earlier through this app. This is its saved result, and I can play it after reopening the project.”

Use a visible **Previously generated through AniForge** label. Do not connect an unrelated new pending job to that earlier result.

### Only the existing server-side smoke clip is available

The local real clip is at:

```text
artifacts/ai-smoke/video-ae1e2a91-58bb-477b-baea-70cb3d65ce00/video.mp4
```

Open that actual file in a player, visibly label it **Real Gemini output — server-side smoke test**, and say:

> “This four-second clip was generated in our server-side Gemini smoke test. A separate deployed-worker verification stored the exact file privately in Cloud Storage. The fresh signed-in browser generation flow still needs verification; this clip demonstrates the provider output, not that complete user journey.”

This is truthful component evidence, but it leaves the central browser workflow unproven. Because the competition requires a working demonstration, complete the production browser check before the final recording if possible. Never disguise this file as a newly completed app request or substitute a test-fixture MP4.

If a live request fails, keep the error visible and describe the failure accurately. A recorded failure or a server smoke test is not a substitute for a successful complete demonstration.

## Exact 3:00 cut option

If the portal enforces the PDF's exact “3 Minutes” label, trim **30 seconds** from the main recording: 5 seconds from the introduction, 5 from the library, 5 from source editing, 5 from analysis, 5 from downloads and 5 from the closing. Remove narration as well as idle time; do not simply speed up all speech. Retain the complete real-generation segment and the Google-service explanation.

| Segment | Revised time |
| --- | --- |
| Introduction | 0:00–0:10 |
| Sign-in/library | 0:10–0:25 |
| Source save/reload | 0:25–0:50 |
| Gemini analysis | 0:50–1:20 |
| Actual video result | 1:20–2:05 |
| Reopen/download | 2:05–2:25 |
| Google architecture | 2:25–2:50 |
| Close | 2:50–3:00 |

## Recording and submission checks

- Record at a readable desktop resolution, preferably 1920 × 1080, with clear voice audio. Zoom the app enough that the shot plan and controls are legible.
- Prioritize the saved studio, analysis and actual video over decorative homepage animation. A pitch alone does not demonstrate functionality.
- Preserve genuine status transitions and label any shortened wait with its measured elapsed time. The recorded 40.886-second smoke result is not a guaranteed duration for a new request.
- Use original/authorized artwork and audio. Do not use protected anime clips as if AniForge generated them.
- Rehearse with the actual clip duration; the verified smoke clip is 4.01 seconds, not six seconds.
- Watch the exported video end to end and verify **3:00–4:00 inclusive**, including title cards and closing frames. Targeting 3:30 leaves margin.
- Upload to an accessible host, test the link without your account, and insert it in [the submission draft](../SUBMISSION_DRAFT.md) and official deck. No upload is performed by this document.
- Fix the repository's unauthenticated 404 and verify the public source link before submission. Keep the deployed app and paid-model access working throughout evaluation.
