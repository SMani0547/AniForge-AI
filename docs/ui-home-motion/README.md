# Homepage typography and motion

October 14, 2026. The homepage now pairs a compact sans-serif hero with italic editorial serif typography, warm paper accents and an arched illustration. It uses installed font stacks rather than adding a remote font dependency. These captures are local Chromium screenshots with reduced motion enabled for stable review:

- [Desktop hero](hero-1440.png)
- [Phone hero](hero-390.png)

Motion includes entrance transitions, one-time scroll reveals, restrained hero parallax, artwork hover zoom, button/link feedback, a reading-progress line and a decorative cursor accent over artwork. Native scrolling and the system cursor remain intact. The cursor is limited to fine mouse pointers and clamped to the viewport. All effects respect reduced motion, including changes made while the page is open.

Content defaults to visible; IntersectionObserver enhances only below-fold content. Focus reveals hidden sections immediately. Observers, media-query listeners, pointer/scroll handlers and scheduled frames are cleaned up on unmount. No animation library or external asset was added. No authentication, backend or AI behavior changed.

Validation: 200 unit tests across 15 files passed; all 13 browser tests passed; after the cursor boundary refinement, the four homepage tests passed again. These cover three responsive screenshot sizes, app entry links, local interactive examples, keyboard/mobile navigation, reveal behavior, cursor behavior and live reduced-motion changes. Desktop and phone screenshots were visually reviewed. Typecheck, lint and production build results are recorded in the main UI results log. Firebase emulators were not rerun for this homepage-only change. Remote deployment, Safari and Firefox have not been checked for this update.
