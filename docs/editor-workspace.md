# Saved source workspace (UI U4)

Open a saved project from `/projects`. Source opens immediately, even with no clip, shot plan or configured AI. The unsaved `/studio/preview` playground remains a separate experience.

The project title, Back to projects, save state and Save scene share a top bar. Tools, import and layers sit to the left of the canvas; Properties and Shot plan share the right inspector. At widths of 1000px and below, Canvas, Tools & layers and Inspector buttons show one panel at a time. This keeps controls usable on phones without squeezing three columns together.

Source and Video are views of one scene. Show video panel also opens the existing video/timeline tools below Source. Hide video panel pauses players. No model request starts merely by opening a view; generation still requires a valid saved plan, ownership affirmation, paid consent and an explicit action. Manual shot planning appears before the optional Gemini request. Suggestions still require review and Apply.

## State and recovery

`CanvasEditor` owns one history, selection, tool, zoom/pan and `SceneSaver`. Source, `AnalysisPanel`, `GenerationPanel` and `VideoVersionsPanel` remain mounted when hidden. They retain local notes, consent, suggestions, request IDs and timeline drafts. Metadata polling continues while the video panel is closed; there is one poll owner, and no automatic paid retry. U6 defers each private MP4 fetch until its player is first shown, then retains that media across view toggles without refetching it.

The global save status and download/reload/retry actions remain outside hidden panels. Analysis results and video activity/errors produce visible notices with an action to reopen their panel, including on compact screens. Server conflicts retain the local document. Incomplete shot plans remain in memory and prevent saving the combined scene; fill the required fields, remove the incomplete plan, or download the local document. Closing the page still loses unsaved local edits after confirmation. This phase does not add offline persistence.

`hidden` removes inactive views from keyboard and accessibility navigation. Editing areas use `inert` during source-bound requests, while the view controls and request recovery stay reachable. Private image/crop and video components retain their state across visibility changes. Reloading the saved scene intentionally creates a new scene session after the existing discard confirmation.

## Coordinates and shortcuts

Documents remain 1920 × 1080. ResizeObserver measures the rendered canvas, ignoring zero-size observations while hidden. Stage scaling maps pointer positions through the inverse transform into canonical coordinates. Fit resets zoom and pan; zoom values are relative to the fitted view. Pan and zoom affect the viewport only, not the saved JSON or canonical AI snapshot.

| Shortcut | Action |
| --- | --- |
| V / P / B / E / H | Select / Pencil / Brush / Eraser / Pan |
| F / Escape | Fit canvas / deselect |
| Ctrl or Cmd + Z | Undo source edit |
| Ctrl or Cmd + Shift + Z | Redo source edit |
| Ctrl or Cmd + S | Save scene |
| Delete or Backspace | Remove unlocked selection |

Shortcuts pause in text inputs, textareas, selects, editable content, open dialogs and the Video view. Shortcut help is available above the canvas. Layers expose selection, hidden/locked state, and separate Raise/Lower buttons; the top row is the front of the drawing. A selected object exposes its relevant shape, text or image crop fields. Drawing tools expose color and size.

## Setup and scope

No new credential, cloud service, package or API schema is required by U4. Local saved projects use the existing Firebase emulator setup (`npm run dev:emulators`); run the web/API services according to the repository README. See [credential inventory and setup](cloud-setup.md) and the [release checklist](release-checklist.md) for production requirements. Production Firebase/Google access and paid Gemini evidence remain separate release gates.

U5 now provides the [generation, comparison and timeline workspace](video-workspace.md) while preserving these request/state owners. It does not add multiclip editing, baked MP4 captions, generated layers or live AI evidence. The [U6 local review](ui-release-review.md) records the broader accessibility and performance checks and their limits.
