# README branding and screenshots

Refreshed October 18, 2026 (Pacific/Fiji). The root README now uses the supplied AniForge wordmark and full logo, charcoal/off-white surfaces, vermilion accents and a red meteor banner. The older purple nautical banner and archived UI screenshots are no longer featured in the README. Historical captures elsewhere in `docs/` remain unchanged.

## Brand assets

- The header uses [`wordmark.png`](../../apps/web/public/brand/wordmark.png); the footer uses [`full-logo.png`](../../apps/web/public/brand/full-logo.png). These are existing crops of the owner's supplied logo. No replacement logo was generated or redrawn. See [brand provenance](../brand/README.md).
- [`hero.svg`](hero.svg) is original code-drawn decoration: an off-white headline, charcoal background and three continuous red meteor ribbons. It contains no external assets, fonts or scripts and is not an AI video result.
- Its entrance animations run once (1.2 and 3.6 seconds), then stop. `prefers-reduced-motion` disables them. Static renderers keep the complete composition; animation support depends on the Markdown viewer.
- The One Piece fan reference remains separate from the product identity and refers to an original creative prompt, not an affiliation or generated franchise content.

## Current UI captures

Every image below is an unaltered local Chromium capture of the current application, taken October 18. These are UI documentation, not proof of a live production generation. Original promotional artwork is not presented as an AniForge-generated video.

| README image | View | Capture method |
| --- | --- | --- |
| [Homepage](screenshots/homepage.png) | Desktop, 1440 × 900 | Existing homepage browser test, real local Vite UI, reduced motion |
| [Mobile homepage](screenshots/homepage-mobile.png) | Phone, 390 × 900 | Same homepage test and current logo assets |
| [Sketch playground](screenshots/playground.png) | Desktop, 1280px wide | Existing browser smoke test draws on the actual canvas; session remains explicitly unsaved and AI disabled |
| [Saved source editor](screenshots/source-editor.png) | Desktop | Actual local Firebase emulator session; original repository artwork imported through the UI, saved and reloaded |
| [Project library](screenshots/project-library.png) | Desktop | Same isolated emulator session; demo projects and their private saved-source thumbnails |
| [Mobile saved editor](screenshots/source-editor-mobile.png) | Phone, 390px wide | Same saved project and current responsive editor |

Emulator labels remain visible. The drawing/source objects and imported artwork are demo inputs, not generated clips. No production accounts or paid AI calls are used to make these captures.

## Validation

- `npm.cmd run test:e2e -- tests/e2e/homepage.spec.ts tests/e2e/smoke.spec.ts`: **8 passed** (24.1 seconds).
- `npm.cmd run test:emulators`: **40 passed** (2.0 minutes), using isolated Auth, Firestore and Storage emulators and explicitly labeled provider fixtures where needed.
- A separate screenshot session created two demo projects, imported `last-tram.webp` and `sky-artist.webp` through the real UI, saved/reloaded source data and waited for actual project thumbnails. It completed with **0 page errors and 0 paid AI requests**. A first attempt competing with the test suite hit the API rate limit; the successful isolated run avoided that contention. All temporary capture/emulator services were stopped afterward.
- SVG XML parsing, self-contained asset checks, one-shot animation completion and reduced-motion behavior passed. The rendered banner was visually reviewed.
- All **41 local README references** resolve; all **9 local images** load. Collapsible sections and code fences are balanced. The README was rendered with local GitHub-like styles, visually checked in light/dark appearances and at a 390px phone width, with no horizontal page overflow. This checks the local preview; GitHub's remote rendering was not exercised.
- Initial attempts encountered the host's disabled `npm.ps1` execution and Windows sandbox denial during Vite/esbuild startup. The successful runs used `npm.cmd` and approved execution outside that sandbox; no application code changed to bypass a test.
- Existing Java `sun.misc.Unsafe`, Node listener-count and color-environment warnings were non-failing.

Typecheck, unit tests and application build were not rerun for this documentation/asset update. The browser suites were run to capture and verify the current UI. No application source, cloud configuration or deployed service was changed.

The root README's verification summary also now points to the dated [real video activation results](../video-activation-results.md); fresh browser generation and a real follow-up edit are still separate acceptance checks. The main app link uses [the custom domain](https://aniforge.shivafj.dev/).
