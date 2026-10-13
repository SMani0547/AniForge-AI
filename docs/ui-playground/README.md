# Sketch playground UI parity

Captured October 13, 2026 from the actual unconfigured app in Chromium. This follow-up replaces the legacy playground layout after U6. No external artwork or AI-generated media is used.

- [1440px desktop](playground-1440.png): shared dashboard branding, labeled tool rail, source canvas and scene assistant.
- [1280px desktop](playground-1280.png) and [actual pointer drawing](playground-drawing.png).
- [768px tablet](playground-768.png): assistant moves below the drawing workspace.
- [390px phone](playground-390.png): compact tools and palette above the canvas, full-width assistant below.
- [720 x 450 reflow](playground-720.png): viewport equivalent of 200% zoom on a 1440 x 900 baseline; not a native browser zoom test.

All captures are full-page. The light line above main content is its keyboard focus outline after navigation. The drawing capture includes the active history-control tooltip. Vertical scrolling is intentional on smaller screens.

The canvas remains an unsaved 1920 x 1080 sketch. Undo, redo, clear, pencil, brush, eraser and color selection remain local. Leaving/refreshing warns when strokes exist; opening projects does not transfer the drawing. AI controls remain disabled with an explanation. Signing in does not remount the playground canvas.

No new credentials or cloud setup are needed for this UI. Production setup and real Google verification remain deferred; see [cloud setup](../cloud-setup.md) and [release checklist](../release-checklist.md). See [actual validation](../ui-upgrade-results.md) for checks and limitations.
