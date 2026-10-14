# Homepage motion rhythm and headings

October 14, 2026. Reveals now target individual headings, paragraphs, figures, workflow steps and FAQ rows. They run for 1.0 seconds (opacity) and 1.2 seconds (movement), with sibling delays of 0/170/340/510 ms. The observer starts reveals when content reaches the lower 88% of the viewport. Tall sections no longer reveal all their contents together.

Interactive panels fade without moving, preserving pointer targets. Keyboard focus reveals controls immediately. Fast scrolls cannot strand content above the viewport. Pause reveals pending content and freezes the decorative loops; reduced motion shows all text immediately. Already revealed content stays visible when motion resumes.

The hero's last line types once, at 110 ms per character after a 600 ms lead-in, without changing its accessible text or reserved layout. A short caret sequence ends automatically. Pause/reduced motion completes typing; resuming does not retype the line. Section-heading accent lines draw in with the headings.

Headings use locally hosted [Oxanium](https://github.com/google/fonts/tree/main/ofl/oxanium), an angular variable face chosen to complement the supplied logo. The unmodified 43,536-byte font and SIL OFL license are retained in `apps/web/public/fonts/oxanium/`. Body copy keeps its existing system font. No animation package, remote runtime font request or AI call was added.

Reviewed [desktop](hero-1440.png) and [phone](hero-390.png) captures, plus the 600px intermediate layout. Typecheck and lint passed; 200 unit tests passed. The first browser run caught focus moving an interactive panel during a click; changing interactive reveals to opacity-only fixed it. The complete rerun passed all 14 tests (20.6 seconds), including loaded font, stagger timing, typing completion, pause/resume, reduced motion, keyboard access and real drawing-example controls. Production build results are recorded in the UI results log. Firebase emulators were not rerun for this homepage presentation change; deployment remains pending.
