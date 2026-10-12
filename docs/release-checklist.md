# Release checklist and evidence

Phase 6 local preparation is separate from release approval. **No production deployment or real Google output is verified yet.** The owner chose to defer cloud/account setup. Do not check a live gate from an emulator, provider fixture, configuration status or health response.

## Build and inspect locally

Run from the repository root with Node 24 and installed dependencies:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run test:built-api
npm run test:e2e
npm run test:emulators
npm audit --omit=dev
```

`build` permits the unconfigured local playground. It scans `apps/web/dist` for known server secret values, a nonsecret CI canary, private-key material, credential files and source maps. This is a bounded scan, not an exhaustive secret audit. The public Firebase Web API key is expected in the browser and is not treated as a server secret. The compiled API smoke checks HTTP health, missing-token rejection, CORS and absence of the internal worker route; it makes no cloud or AI request.

After installing Docker with Linux containers, verify the exact container:

```powershell
docker build --platform linux/amd64 --file apps/api/Dockerfile --tag aniforge-api:check .
npm run test:container
```

The container smoke runs API and worker separately with external networking disabled and AI off, verifies nonroot execution, checks API health/401 and worker unsigned-request 401, then removes only its own temporary containers. It does not test real OIDC, Firebase IAM, Storage or Google AI. CI runs these commands on Linux; adding CI steps is not evidence that a remote run passed. No Docker installation is available on the implementation machine.

## Configure the release build

1. Complete the [account, Firebase, IAM, bucket and key setup](cloud-setup.md) and [private worker/queue setup](video-worker-setup.md). Use the same real project on the frontend and API. Public paid anonymous access requires explicit quota/budget and abuse-control review; per-user limits are not a global cap.
2. In ignored `apps/web/.env.local`, supply the four public Firebase Web values and `VITE_API_BASE_URL=https://YOUR_API_SERVICE.run.app/api/v1`. This release guard expects the project's standard `PROJECT_ID.firebaseapp.com` auth domain. A custom auth domain needs a reviewed change to the guard and Firebase provider settings.
3. Leave the Auth emulator URL empty. Enable the guest button only if Anonymous Auth is enabled and its paid-use implications have been accepted. Never put server settings under `VITE_*`.
4. Run `npm run build:release`. It validates public configuration before bundling, rejects missing/placeholder/demo values, unapproved `VITE_*` names and non-HTTPS/non-API endpoints, then scans the output. Validation proves syntax only; it cannot verify account access or API reachability.
5. `firebase.json` runs this build as a Hosting predeploy hook. Firebase supplies `GCLOUD_PROJECT`, which must equal the frontend Firebase project. A plain unconfigured `npm run build` cannot bypass this normal deploy hook. Do not remove the hook to make a blocked release appear successful.
6. Once the actual Hosting origin is known, set the public homepage's absolute canonical URL, `og:url` and `og:image` in `apps/web/index.html`, rebuild and verify the deployed social preview. See [homepage assets and metadata](homepage.md). Keep private project content out of public metadata.

Vite loads `.env.local` plus mode-specific files such as `.env.release.local`; shell environment values have priority. Check for stale overrides when validation fails. [Vite environment behavior](https://vite.dev/guide/env-and-mode), [Firebase deploy hooks](https://firebase.google.com/docs/cli#predeploy_and_postdeploy_hooks).

Deploy the tested container, private worker, recovery/cleanup schedules and Hosting using the existing runbooks. Keep paid switches off until non-billable identity/access checks succeed. For an existing Phase 4 installation, follow the documented worker-first rollout. No deploy command is run by this checklist or the local checks.

## Live evidence record — all pending

Record actual URLs, commit/image digest, UTC time, account region and private evidence locations after each step. Keep tokens, prompts containing private material and provider IDs out of public screenshots. Store detailed evidence in ignored `artifacts/release/`, and publish only reviewed redacted results.

| Gate | Required evidence | Status |
| --- | --- | --- |
| Deployment | Hosting URL; API/worker revisions and image digest; intended traffic allocation | Pending |
| Fresh user | Incognito Google sign-in, create project, import creator-owned artwork and save/reload editable objects | Pending |
| Real analysis | Actual Google response validates; suggestion is reviewed; edited plan/source survive reload | Pending |
| Initial video | 202/job ID promptly; real worker succeeds; stored Google MP4 plays after refresh | Pending |
| Conversational revision | Distinct provider interaction, immutable child version, visible requested change; both clips play independently | Pending |
| Restore/export | Earlier version can be selected and reloaded; downloaded bytes match stored MP4; timeline-only overlay disclosure is visible | Pending |
| Failure preservation | Safe failed job is visible; old MP4, selection and editable source remain unchanged | Pending |
| User isolation | User B cannot read/update/export User A's project, source, job or version; direct database/bucket access denied | Pending |
| Worker isolation | No public/broad Run invoker grant; absent/wrong Google identity denied; non-billable missing-job task validates real OIDC | Pending |
| Recovery | Scheduled recovery/cleanup run successfully; task redelivery does not repeat a paid create | Pending |
| Browser privacy | Inspect deployed assets/network; no server secrets or public media URLs; allowed-origin and unauthorized-origin checks | Pending |
| Cost/latency | Actual analysis, generation and edit elapsed time, charge/currency, quota response and retries | Pending |

For ownership checks, create two disposable accounts/projects. Obtain each account's Firebase ID token privately in its own browser context; never paste tokens into chat or screenshots. Use B's token against A's exact resource IDs for GET/PATCH/edit/export, expecting 404; missing-token requests must return 401. These negative requests must not enqueue work. Use A's token to verify A's data still exists afterward. Also test the private Storage object's URL without authorization: it must not return media. Do not change bucket privacy to fix a broken player.

Costs are currently **not measured**. Record the actual provider billing amount and currency; do not infer a price from the model name or a fixture. Configuration availability and `/health` report setup/process state, not these live results.

## Demo and submission

- Rehearse the [three-minute script](demo-script.md), using only owned/licensed artwork.
- Fill the [eight-slide outline](pitch-outline.md) with verified screenshots and URLs. Producing a PDF deck and final public video remains pending.
- Replace labeled local-fixture screenshots with genuine app evidence before claiming AI results. See [evidence notes](demo/README.md).
- If showing previously generated real outputs, say so and retain their provenance. If no real Google clip exists, present the local prototype honestly and leave the real-model gate incomplete.
- Verify the actual competition portal's deadline, timezone, theme labels, required formats and link access before submission; the build plan's target date is not portal verification.

Official deployment references: [Firebase Hosting configuration](https://firebase.google.com/docs/hosting/full-config), [Cloud Run container contract](https://docs.cloud.google.com/run/docs/container-contract). Local build success alone does not establish deployed behavior.
