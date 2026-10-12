# AniForge AI — three-minute walkthrough

Use this script only with the evidence available. Current status: local implementation with explicit test fixtures; real Google output and live deployment are pending. Do not narrate a fixture as Gemini output. Use original artwork with recorded permission; no protected-character sample is supplied.

| Time | Screen/action | Narration |
| --- | --- | --- |
| 0:00–0:20 | Project gallery and original sketch | “AniForge helps a creator turn an original drawing into a short animated shot while keeping the source and every revision.” |
| 0:20–0:50 | Sign in; create project; import own sketch; move a layer; save and reload | “The drawing stays editable. These objects and crop settings survive refresh, and the project belongs to this account.” |
| 0:50–1:20 | Analyze; review a real response; adjust direction; explicitly apply/save | “Gemini proposes a shot plan. I review it and choose the motion and framing before paying for video generation.” If unavailable: “This is a manually authored plan; live Gemini analysis is not verified yet.” |
| 1:20–2:00 | Approve paid generation; show queued job and real stored result | “Generation runs in a private worker. The browser gets a job ID immediately; errors stay visible.” If cutting a wait: visibly label elapsed time. If using stored real output: “This clip was generated earlier through this app.” Never substitute the geometric test MP4 here as real output. |
| 2:00–2:35 | Submit one edit; compare parent/child; restore earlier selection | “This change creates another clip. The original video and drawing remain available.” Show the actual requested visual change, not just two different IDs. |
| 2:35–3:00 | Caption/trim preview; download; architecture | “Trim and captions are editable preview settings. The MP4 download is the original stored clip, without those overlays. Firebase stores project state, and Cloud Run handles private, queued Google AI work.” Use deployed wording only after verification. |

## Rehearsal preparation

Choose one simple six-second shot: a creator-owned abstract landscape or original character, one gentle motion, one camera direction. Prefer an edit that can be visually checked, such as slowing the camera or changing wind intensity. The suggestion is a demo prompt, not a guarantee of model behavior. Record the actual result and any failure.

Before recording: verify fresh sign-in, paid entitlement/remaining allowance, queue/recovery, asset privacy, browser playback and both downloads. Close consoles exposing credentials or IDs. Record the tested commit, image digest, live URL and real charge privately. Generation timing is not guaranteed; rehearse and budget time instead of fabricating a fast success. Keep a clearly labeled previously generated real clip only after genuine app success.

## If cloud setup is still pending

Demonstrate real local Auth/Firestore/Storage, canvas save/reload and manually edited shot plans via `npm run dev:emulators`. Explain that Google calls are disabled in this mode. Use the automated test screenshot only to explain the implemented revision UI, visibly retaining its TEST FIXTURE labels. Do not claim the runtime emulator can generate a clip: provider substitution exists only in tests. Finish with the remaining credential/deployment gates.
