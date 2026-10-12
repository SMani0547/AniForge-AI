# AGENTS.md — AniForge AI

You are contributing to **AniForge AI**, a real, deployed Google AI-powered anime creation studio for the AI Builder Cup 2026.

## Goal
Build a working end-to-end vertical slice: user can sign in, create project, import/edit an original sketch, save and reload an editable scene, call Gemini to analyze it, generate a real animated clip using Gemini Omni Flash, issue a follow-up edit, see separate versions and download the result. Deploy frontend on Firebase Hosting and backend on Cloud Run. Completion target: Oct 18, 2026.

## Read first
Read `BUILD_PLAN.md` for scope, architecture, user flows, Firestore model, API endpoints, and test criteria. No need to implement every P1 feature for the hackathon; P0 is priority.

## Development principles
- Build one milestone at a time. Prefer small, testable commits; avoid a giant unreviewable patch.
- Use React/Vite/TypeScript, react-konva, Tailwind, Node/TypeScript/Fastify, Firebase Auth/Admin, Firestore, Cloud Storage, Cloud Tasks and `@google/genai` on server.
- TypeScript strict mode; Zod for validation; explicit error states and loading UX; accessible controls.
- Keep drawing/source objects in editable JSON; store image/video as private media assets. An MP4 is not inherently editable layers.
- Keep every AI video version immutable, recording parent version and provider interaction ID when possible.
- Use real Gemini API for production; mock AI provider only in explicitly labeled dev/test mode. Never represent fake response as successful generation.
- Secrets stay on server, no `.env` in version control, no Gemini API key in browser. Access control on projects, jobs and assets enforced server side.
- Do not invent or assume active Google Cloud credentials. Ask user only for unavoidable credentials / required console steps, and otherwise implement files needed to proceed.
- Use official model docs for request formats and supported features; handle retries, 429s, bad responses and job timeouts.
- User-owned/original image content only; include copyright affirmation on import and no protected character copying in sample assets.
- Maintain minimal tests: schemas, canvas serialization, project ownership, job state, provider mocks, one browser E2E smoke.
- After each milestone, run typecheck, lint, tests and build; repair errors, and report what actually passed, not assumed status.

## MVP gates
1. App boots locally and auth/project gallery works.
2. Canvas edits survive browser refresh.
3. Real Gemini analysis returns schema-valid result.
4. Real Omni Flash provider can produce a stored MP4 on configured paid API.
5. Conversational edit produces new version; old version still playable.
6. Final deploy: Firebase Hosting + Cloud Run, user media private and job errors visible.

## Priority
P0 vertical slice and deployment > stability/tests > accessibility > P1 extras > animation extravagance.
