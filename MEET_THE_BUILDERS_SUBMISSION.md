# AniForge AI — Meet the Builders submission pack

Prepared November 18, 2026, using the submission instructions supplied by the owner. The owner already recorded a demo for the original AniForge submission. **Reuse that recording** if it meets the new limits; otherwise make a shorter edit. A new recording of the entire demo is not required. The optional 85-second outline below can guide the edit; the earlier AI Builder Cup 3:30 target does not apply here.

Replace every bracketed placeholder before posting. The owner's introduction details and the two additional members' names/profile links have been requested; no names or contributions have been guessed. Nothing has been posted or uploaded by preparing this file.

## 1. Two submission forms: shared materials

The supplied portal text shows **Hall of Fame Submissions** and **Get Featured Submission** as separate forms. Both request the same kind of demo video, three Google AI tool bullets and public social post. Nothing in the supplied text requires different recordings or posts for the two forms, so prepare one compliant set of materials and reuse it if submitting to both. Separate challenge eligibility rules, if any, are not included in the pasted instructions.

| Form field | Hall of Fame | Get Featured | What to enter |
| --- | --- | --- | --- |
| Challenges | Required | Required | Select the applicable challenge from the actual dropdown; its options have not been supplied, so no selection is assumed here |
| GitHub Repository Link | Required | No separate URL field shown | `https://github.com/SMani0547/AniForge-AI` |
| Demo Video Drive Link | Required | Required | The same public Google Drive video link, if the recording meets both forms' identical limits |
| Google AI Tools Used | Three bullets; 1,024-character field | Three bullets; 1,024-character field | Copy the three bullets below |
| Link to Your Social Media Post | Required | Required | The same public LinkedIn post permalink containing `#Meetthebuilders` |
| Consent to GitHub repository publication | Required Yes/No choice | Required Yes/No choice, despite no repository URL field shown | Choose Yes only if you agree to the stated publication; no consent or submission has been made on your behalf |

**GitHub README:** Hall of Fame requires a public repository with a short explanation of what the project does and how to run it. The current [README](README.md) already contains a project overview and a Local setup section. Keep those easy to find; no code upload is requested.

**Portal label ambiguity:** the Hall of Fame video field appears to repeat “Google AI Tools Used (3 bullet points)” in its label. Because a separate tools field follows, put just the Drive URL in the video field and the three bullets in the separate tools field. This is an interpretation of the pasted form layout, not a verified portal behavior.

**Shared deadline:** November 26, 2026, **06:29 AM IST**, equivalent to **12:59 PM in Fiji** on the same date. The “under 5 minutes” introduction does not change the explicitly stated video maximum of 90 seconds. The `/3 Add Submission` control does not establish a requirement to submit three projects.

The Get Featured instructions say selection can lead to publication on the Meet the Builders page and the Google Gen AI APAC Builder 2026 badge; neither outcome is guaranteed by submitting. The supplied Hall of Fame text does not state a separate award outcome.

### GitHub Repository Link — Hall of Fame

https://github.com/SMani0547/AniForge-AI

### Demo Video Drive Link

[ADD: public Google Drive link to the finished demo video]

The uploaded file must be **under 15 MB** and **90 seconds or less**, and must begin with you on camera saying your name and where you are from. If your existing video already meets these conditions, use it directly. If not, trim/re-encode it and add only the missing camera introduction. Target **85 seconds** to leave a margin. Set Drive access to **Anyone with the link — Viewer**, then confirm a signed-out viewer can open and play it. A YouTube link does not replace the specifically requested Drive link. The existing recording has not been supplied for duration, file-size or opening-frame inspection.

### Google AI Tools Used

Copy these three bullets:

- **Gemini 3.8 Flash (`gemini-3.8-flash`, Gemini API):** analyzes original artwork and creator notes to propose a structured shot plan with subjects, action, camera direction and details to preserve.
- **Gemini Omni Flash (`gemini-omni-1.1-flash`, Gemini API):** generates short animated video clips from an original scene image and the creator's reviewed direction.
- **Google Gen AI SDK (`@google/genai`):** connects our Node.js backend to Gemini for analysis and video requests and retrieves generated output while keeping API credentials on the server.

Accuracy note for the presenter: these are **two Gemini models and Google's integration SDK**, not three independent AI platforms. They are all present in this project's code and evidence. Do not invent a third model or claim use of Vertex AI, Veo, Imagen or Firebase AI Logic. Firebase Hosting/Auth, Firestore, Cloud Run, Storage and Tasks are supporting infrastructure; they are not additional AI models. If an organizer specifically requires three independent AI products, clarify that requirement rather than relabel infrastructure as AI.

### Link to Your Social Media Post

[ADD: permalink to your published public LinkedIn post]

Use the individual post's link, not your LinkedIn profile. Its text must contain **#Meetthebuilders**. Posting only on LinkedIn meets the supplied social-post instruction; including the demo video in that post is optional.

## 2. LinkedIn post — ready to personalize

What if an original sketch could become the starting point for an animated scene—while the drawing stayed editable?

Meet **AniForge AI**, an open-source anime creation studio we built for artists, students and independent storytellers.

The workflow brings together an editable canvas, saved projects, Gemini-assisted shot planning and short-video generation. Creators review the direction before requesting a clip, with source artwork stored separately from generated video.

Our Google AI stack:
• Gemini 3.8 Flash analyzes the artwork and proposes a shot plan.
• Gemini Omni Flash generates short animated clips from the image and direction.
• The Google Gen AI SDK connects these calls securely through our backend.

Firebase, Firestore and Cloud Run support the app, saved project data and backend services. We verified real Gemini analysis and an initial generated clip, including private cloud storage of the output.

Built together with **[TEAMMATE 1 — select their LinkedIn profile]** and **[TEAMMATE 2 — select their LinkedIn profile]**. Proud to share what we created as a team.

Explore the project: https://aniforge.shivafj.dev/
Source code: https://github.com/SMani0547/AniForge-AI

Paid AI generation is currently paused to control costs; the recorded demo uses genuine output generated earlier.

I'd love feedback from illustrators and storytellers: what would help you turn your next sketch into a moving scene?

#Meetthebuilders #GoogleAI #Gemini #Firebase #OpenSource #Anime

### Before publishing the post

- Replace the two teammate placeholders. Type `@` in LinkedIn and select the correct profile for an actual mention; text copied from this document does not create a working tag by itself.
- Optional contribution line, only after confirming the roles: “Team: [YOUR NAME] — [CONTRIBUTION]; [TEAMMATE 1] — [CONTRIBUTION]; [TEAMMATE 2] — [CONTRIBUTION].” Do not assign roles without confirmation.
- Use a public/Anyone post audience. Attach the [current homepage screenshot](docs/readme/screenshots/homepage.png), or the [saved editor screenshot](docs/readme/screenshots/source-editor.png) with the caption “Local prototype editor with original demo artwork.” The editor capture contains emulator labels; do not crop them away to imply a production capture.
- Keep the paused-AI sentence unless the service has genuinely been re-enabled and verified. Do not announce selection, a Google endorsement or the badge before it is awarded.
- After publishing, copy the post permalink into field 3 and check access without your account.

## 3. Reuse the existing demo — optional 85-second edit guide

Keep the best genuine working sections of your original recording: source editing/save, actual Gemini analysis, video playback and the explanation of who it helps. Remove long loading periods and repeated navigation; label any shortened generation wait. If it lacks the required face-to-camera introduction, record only that short opening and prepend it, then trim the combined result to at most 90 seconds.

Add a clear caption where appropriate: **Recorded while AI was enabled; new paid generation is currently paused.** Your existing recording may demonstrate more than the repository's last verification record; describe only what the footage actually shows. Do not replace a genuine app-generation recording with the server-test footage merely to follow the optional wording below.

**Start with your face on camera at 0:00.** Do not put a logo animation, screenshot or title card before the introduction. A small name/location caption is fine. Show the actual app after your introduction, rather than presenting only slides.

Read only the narration column. Personalize the introduction, rehearse at a natural pace and keep the full exported video—including the opening and ending—under 90 seconds.

| Time | Screen/action | Narration |
| --- | --- | --- |
| 0:00–0:10 | You on camera. Introduce yourself before switching to screen recording. | “Hi, I'm [YOUR NAME] from [CITY, COUNTRY]. Together with [MEMBER 1] and [MEMBER 2], I built AniForge AI.” |
| 0:10–0:20 | Switch to the homepage briefly, then your actual saved project. | “Turning an original drawing into animation involves more than generating a video. Creators also need control over the artwork and the direction.” |
| 0:20–0:36 | Show Sky Artist in the source editor. Make a small real change, save, refresh and show it persisted. | “In AniForge, I can import my own artwork, adjust the scene and save it. After refreshing, the source is still editable. This is the starting point for the shot.” |
| 0:36–0:48 | Show an actual saved shot plan from the previous successful analysis. Label it “Previously generated Gemini analysis.” Do not click a disabled Analyze button and cut to a result as though it just ran. | “Gemini 3.8 Flash analyzes the artwork and suggests action, camera movement and details to preserve. Here is a saved plan that I can review and adjust.” |
| 0:48–1:04 | Play the genuine existing four-second MP4 in a player. Label it “Real Gemini output — earlier server-side test.” Keep the source image visible alongside if practical. | “Gemini Omni Flash generated this clip in our earlier server-side test. Our Google Gen AI SDK integration handles the requests. Paid generation is currently paused to control costs.” |
| 1:04–1:16 | Return to the saved editor/project library. Show the team names as a small overlay if desired. | “AniForge is for illustrators, students and independent storytellers exploring short animated scenes. It keeps the original drawing and creative direction alongside the video.” |
| 1:16–1:25 | Show the website and repository URLs, then optionally return to camera. | “The project and source code are public. We'd love your feedback on AniForge AI. Thank you for meeting our team.” |

The script follows the evidence available in this repository, not an assumed fresh production AI call. If a saved analysis result is no longer available, use a genuine previous recording of that result with an on-screen label. Otherwise show a manual plan and explicitly say it is manually authored; do not present it as Gemini output.

The existing verified clip came from a server-side test and separate cloud recovery/storage verification. Do not call it a fresh end-to-end browser generation. If you have a later genuine app-generation recording, you can use it instead and accurately label when and how it was generated. Real follow-up edits remain unverified in the records, so they are not claimed in this short script.

The supplied rules require a working demonstration. Record actual source editing/save/reload plus the genuine output, and disclose the paused AI feature. This document cannot guarantee that a demonstration with paused paid features will satisfy the organizer. A fresh live AI demonstration would require a separate, explicit request to re-enable paid services; no reactivation was performed for this pack.

## 4. Demo assets and export checklist

- Primary input: [Sky Artist](apps/web/public/artwork/sky-artist.webp). Keep the character visible in the scene and use original/authorized artwork.
- Optional second project: [Last Tram](apps/web/public/artwork/last-tram.webp).
- Real generated video, confirmed present locally at preparation time (1,906,656 bytes): `artifacts/ai-smoke/video-ae1e2a91-58bb-477b-baea-70cb3d65ce00/video.mp4`. It is private, ignored by Git, and is not an accessible submission link; include its playback inside your finished demo.
- Use the supplied [wordmark](apps/web/public/brand/wordmark.png) only as an overlay or ending graphic. Your face must appear first.
- Do not show API keys, `.env`, private account details or raw provider metadata.
- Export a readable MP4. For the strict file limit, 720p with a total average bitrate around 1 Mb/s is a useful starting point: 85 seconds is approximately 10.6 MB before container overhead. This is an estimate, not a guarantee; check the actual final file and keep it below 15,000,000 bytes, preferably below 14 MB.
- Check the final recording is no longer than 90 seconds, includes audible name/location, shows working interactions, names the Google AI tools and says who benefits.
- Upload the finished MP4 to Google Drive, set **Anyone with the link — Viewer**, and play it from a signed-out browser. Verify audio as well as picture.
- Publish the LinkedIn post with **#Meetthebuilders**, check its public permalink, then complete the relevant form using the mapping above. Hall of Fame also requires the public GitHub URL. Both forms include a challenge selection and publication-consent choice. No code upload is required by the supplied instructions.

## 5. Preparation checks and remaining fields

November 18 public unauthenticated HTTP checks returned **200** for both the website and GitHub repository. This verifies basic reachability, not production sign-in or AI operation. The last verified production configuration is the October 22 [paid AI shutdown](docs/ai-shutdown-status.md); no cloud setting was changed for this submission pack.

Still needed:

- [ ] Your spoken name and location.
- [ ] Both teammates' names and, for mentions, their correct LinkedIn profiles.
- [ ] Existing demo checked/trimmed for duration, file size and camera introduction, then uploaded with a public Drive link.
- [ ] Published public LinkedIn post and its permalink.
- [ ] Removal of all placeholders before submission.
- [ ] Applicable challenge selected and repository-publication consent answered separately in each form being submitted.

Source records: [analysis/video activation evidence](docs/video-activation-results.md), [server model configuration](apps/api/src/ai/config.ts), [SDK dependency](apps/api/package.json), [official Google Gen AI SDK](https://github.com/googleapis/js-genai) and [official Gemini Omni model documentation](https://aistudio.google.com/docs/models/gemini-omni-flash). The model identifiers above describe this project's configured and recorded implementation; they are not claims that it uses a newer model version.
