# U2 homepage evidence

Actual local Chromium captures of the new public `/` route, October 13, 2026 (Pacific/Fiji). The illustration is original vector artwork, not Google output. These captures verify local UI rendering, not deployment or live generation.

- [Desktop hero](hero-1440.png), [tablet hero](hero-768.png), [mobile hero](hero-390.png).
- [Full desktop page](homepage-1440.png), [full tablet page](homepage-768.png), [full mobile page](homepage-390.png).
- [Product demonstrations](product-1440.png), [original-art showcase](examples-1440.png), [FAQ](faq-1440.png).
- [Social preview asset](../../apps/web/public/social-preview.png) — 1200×630 original vector export.

Regenerate with `npm run test:e2e`. `homepage.spec.ts` writes these to `test-results/unconfigured/homepage-public-homepage-*/`. Review the images before copying them here. The screenshots are unmodified test artifacts. Tests additionally check links, local example controls, responsive overflow, metadata assets, mobile Escape handling, reduced motion and the absence of private-service/editor requests. The Firebase-emulator suite separately verifies the homepage-to-saved-editor journey.
