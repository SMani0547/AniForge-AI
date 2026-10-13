# Video workspace (UI U5)

Open **Video** in a saved project, or expand **Show video panel** below Source. Drawing remains available before any video exists. The empty stage offers **Keep drawing** and **Plan an animation**; unavailable AI leaves source editing and manual planning usable.

## Prepare and submit

The request column shows the source save state, shot summary and request scope. Expand **Video prompt preview**, review the plan and check **I reviewed this shot plan and animation prompt**. Changing the plan invalidates that review. Checking or clearing review resets paid consent. Ownership permission, paid confirmation and an explicit **Generate animation** action are still required.

Submission saves the complete scene, renders its canonical snapshot and captures its saved revision before queuing. Source editing pauses during this submission, then resumes while the job is queued or running. Activity identifies each job's source revision even after later drawing changes. Queued, generating/storing, completed and failed states reflect server records; there is no invented percentage or completion estimate. Expand Request details for IDs and recovery limits.

A lost response preserves the request in session storage. **Retry same video request** reuses the captured ID, revision and snapshot; it does not use newly edited controls. After reloading, reconfirm permission and paid consent before replay. Creating a new request remains explicit. Switching views, comparing versions and downloading never dispatch paid work.

## Review versions

Playback leads the review area. Each version card shows its source revision, creation time and parent when applicable. The native **Video version** selector remains available. Previewing a card does not save the scene selection; **Use this version** saves it through the existing revision-controlled scene saver. Editing timeline settings also selects that previewed version, as before.

**Compare with parent** displays two independent players. Hiding the comparison pauses the parent; closing the Video panel pauses both players. Since U6, private MP4 retrieval waits until a player is first shown; subsequent visibility changes keep its loaded media. A previous version remains immutable and available for preview or restored selection. Expand **Saved version prompt & provenance** to inspect the requested change and parent. AI edits retain their own instruction, permission, paid confirmation and pending-request recovery. Failed edits preserve earlier clips and scene selection.

## Timeline and downloads

The single-clip timeline follows actual media playback. Play/Pause and the labeled playhead slider control the current video; arrow keys seek in 0.01-second steps and Home/End reach the current preview bounds. The ruler and caption bands use the original clip clock. Exact trim/caption fields remain keyboard accessible, and saved settings survive reload. The continuously updating clock does not announce every playback tick.

Invalid settings remain a visible local draft and block scene saving until corrected. During that draft, playback uses the full clip. Switching versions keeps settings for review against the new duration. The timeline is browser preview metadata, not a multiclip or audio editor.

- **Download original MP4** fetches the chosen version's exact stored bytes through the authenticated API. Preview trimming and captions are not encoded into it.
- **Download editable timeline JSON** exports the current previewed version ID and timeline, including an unsaved draft, with an explicit unchanged-MP4 note. It is a metadata export, not a new rendered video or a complete source project backup.

## Setup and verification

U5 introduces no dependency, credential, cloud service or API schema. Use the existing [local emulator setup](local-emulators.md) for saved projects. Production credentials, billing, IAM, private storage and deployment steps remain in [cloud setup](cloud-setup.md) and the [release checklist](release-checklist.md). Paid Google analysis/generation/edit and production authentication remain unverified until that setup is completed.

The video browser test uses real Fastify, Firebase Auth, Firestore and Storage emulators with explicitly labeled repository-authored MP4 fixtures. It exercises lost-response replay, fixed job revisions during ongoing drawing, real playback, independent comparison, saved selection and timeline, exact MP4/JSON downloads, failed edits and 390px layout. It does not call Google or certify live generation. See [actual results](ui-upgrade-results.md) and [captures](ui-u5/README.md). The broader local [U6 review](ui-release-review.md) records accessibility, zoom-equivalent reflow, performance measurements and remaining manual/live checks.
