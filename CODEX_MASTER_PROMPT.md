# Codex Master Prompt — AniForge AI

Copy the text below into Codex **after** placing `BUILD_PLAN.md` and `AGENTS.md` at the repository root.

---

I want you to build **AniForge AI**, a hackathon-ready AI-powered anime creation and editing studio, using the detailed `BUILD_PLAN.md` as the source of truth and following `AGENTS.md` project rules.

**Core outcome:** A user can start from an original sketch/manga panel, edit it on a real canvas, use Gemini to turn it into a structured storyboard shot, generate an animated MP4 clip using Google's paid Gemini Omni Flash model, request a conversational edit, compare the original and revised versions, save/reopen their project, and download the resulting video. The web frontend must deploy to Firebase Hosting; the backend must deploy on Cloud Run.

**Mandatory technologies:** React + Vite + TypeScript, Tailwind CSS, React Konva, Firebase Authentication, Cloud Firestore, Google Cloud Storage, Node TypeScript + Fastify, `@google/genai` on backend, Cloud Tasks/Cloud Run job worker pattern, Zod, Vitest and Playwright. Use a monorepo `apps/web`, `apps/api`, `packages/shared` with TypeScript strict mode.

**Do not make misleading claims:** Generated videos are flat MP4 clips, not automatically separated editable layers. Keep scene drawing objects, storyboard data, timeline edits, captions, prompt and generation version metadata in separate editable structures. For video edits, call the model to produce a new version and preserve the previous MP4.

**First task, before heavy UI work:**
1. Inspect this repo and the build plan; identify what is already present.
2. Create a detailed `TODO.md` with milestones, acceptance criteria, and actual remaining blockers.
3. Bootstrap a clean, attractive, responsive dark studio and fully wired development architecture.
4. Build a **small server-only Gemini provider smoke test** for a real image+video generation request (using the official Gemini Omni docs and model `gemini-omni-1.1-flash`), with a separate analysis smoke test; require environment variables and paid entitlement, produce an MP4 only when a real request succeeds, and log safe actionable errors if unavailable. Never mock a live result silently.
5. Implement Phase 1 end-to-end and run tests; then continue sequentially to the next milestone as time and repo state allow.

**Functional requirements, in priority order:**
- Project gallery and owner-only Firestore project access.
- Studio drawing editor with pencil, eraser, select/drag/resize, layers, image import and manual crop, undo/redo, save/reload source canvas JSON.
- Asset upload to private Cloud Storage, with authorized access.
- Gemini analysis of sketch to structured editable shot plan; Zod validation and user override.
- AI video generation job and clip player; real status/error management through queue and storage.
- Gemini Omni conversational edit with `previous_interaction_id` where supported, preserving original version; compare revisions and restore selected version.
- Minimal timeline and MP4 download; proper UI responsiveness, loading, errors, accessibility.
- End-to-end cloud deployment configuration and README deployment guide.

**API design:** Implement project/scenes/assets/analysis/generation/edit/version/job/export routes described in `BUILD_PLAN.md`, using Fastify and Zod. All user routes verify Firebase Auth and resource ownership. Internal task routes verify trusted task service identity. Never expose provider credentials or allow arbitrary unauthenticated generation.

**Design direction:** Polished dark anime creative desktop studio. Charcoal background, electric blue + subtle violet, professional toolbars and inspector, plenty of breathing room. Use Lucide icons, subtle transitions, clean visual hierarchy. Do not waste time on an unused marketing homepage before the studio works.

**Testing and report protocol:** At the end of each phase: list files changed, commands executed, tests/build result, which features truly work (mock vs real), remaining issues, and what cloud access/credentials are needed. Do not claim successful API testing, video generation, deployment or database migrations without evidence. Favor reproducible commands and small commits.

Start now: read the blueprint and implement the foundation and day-one real-model proof-of-concept. Do not wait for nonessential design clarifications. Make sensible engineering choices consistent with the blueprint.

---

## Follow-up milestone prompts

### Milestone 2 — Canvas and persistence

Implement the saved editable Konva canvas with image upload, manual panel selection, layers, inspector, undo/redo and Firebase project/scene persistence. Write unit and Playwright tests proving a canvas edit survives reload. Run all checks.

### Milestone 3 — Gemini analysis

Implement secure server-side Gemini image analysis of a saved scene into editable, Zod-validated shot plan. Add loading/error UI, prompt preview and test fixture. Use a real Google model in paid-enabled integration mode; never fake production output. Run checks.

### Milestone 4 — Video generation and jobs

Implement paid Gemini Omni video generation with a queue-backed job state machine, private GCS storage, playable MP4, safe retries and visible errors. Use official model docs and a real integration smoke test if credentials exist. Avoid holding browser requests open. Run checks.

### Milestone 5 — Conversational editing and versions

Implement `previous_interaction_id` video editing in Gemini Omni, new immutable version records, source/edited comparison, revert selection, and prompt history. Ensure model failures do not destroy previous video. Add provider tests and run checks.

### Milestone 6 — Cloud deployment and submission

Complete UX, single-clip export, authorized URLs, production build, Firebase Hosting + Cloud Run deploy files and instructions, tests, demo script, 8-slide pitch outline, and deployment verification checklist. Run all available checks and explicitly report manual Google Cloud steps left.
