# AniForge AI — eight-slide pitch outline

Draft copy and visual direction, not a completed slide deck/PDF. Mark current local evidence versus future/live claims visibly. No usage, cost or performance metrics have been measured with real Google generation yet.

| Slide | Main message | Content and evidence |
| --- | --- | --- |
| 1. AniForge AI | Draw it. Animate it. Keep control. | Subtitle: “An original-art studio with editable source and preserved video revisions.” Use the original sketch beside genuine resulting clips only when available; otherwise label the local prototype. |
| 2. The problem | A generated movie alone leaves little room to revise the source. | Explain the steps a creator repeats: drawing, motion direction, generation and comparison. Treat this as the product hypothesis; do not invent customer interviews or market statistics. |
| 3. Who it helps | Original storytellers, indie creators and educators. | One concrete task: test a short scene's motion without losing the initial drawing. State intended benefit, not measured time savings. |
| 4. The journey | Sketch → plan → animate → edit → download. | Show editable layers, reviewed shot plan, queued job, two versions and export. Call out that captions/trim are browser previews and MP4s are flat clips. |
| 5. Architecture | Private data and server-side AI. | React/Konva → authenticated Fastify API → Firestore/private Storage. Cloud Tasks → private Cloud Run worker → Gemini → immutable MP4. Keep API keys off the frontend; ownership is checked server-side. Distinguish deployed services from configured code. |
| 6. Creator control | A new edit preserves the original. | Parent-linked immutable versions, original drawing/plan, explicit paid consent and saved selection. Frame differentiation as implemented design choices, not unsupported comparisons with competitors. |
| 7. Demo evidence | Show the original and the real change. | Real artwork, real initial clip, distinct real edit, old clip still playable, deployed URL and tested commit. Until verified, label local fixture evidence and leave live URL/cost fields pending. |
| 8. What comes next | Complete live validation, then extend the editor. | Immediate: billing/model access, cloud deployment and recorded end-to-end evidence. Later: character consistency, multiple scenes and encoded timeline export. Measure reliability, latency and cost before scaling. |

Suggested look: charcoal background, blue/violet accents and large readable screenshots. Keep one primary message per slide. Export to PDF and test readability/link access only after replacing pending evidence. Do not include private prompts, media links, tokens or provider interaction IDs in the public deck.
