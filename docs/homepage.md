# U2 public homepage

The public `/` route now uses the U1 visual foundation as a real homepage. `/projects` retains the existing authenticated gallery, `/studio/:projectId` the saved editor and `/studio/preview` the unsaved drawing playground. `/design` remains a development-only study. Dashboard/editor visual migrations are still U3/U4 work.

## Content and behavior

The homepage has Product, How it works, Examples and FAQ anchors, an original-art hero, four workflow steps, alternating source/plan/version examples, a labeled artwork showcase, creator-control information and closing calls to action. Open studio navigates to `/projects`; Try drawing goes directly to the functioning playground. The application's brand button returns to `/` through the existing navigation guard.

The page declares the current early-build status: drawing and manual planning are available, while live Google analysis/video/edit verification remains pending. Its layer visibility control and palette switch modify the original SVG locally. The editable shot direction is explicitly a manually authored example. No request, save, upload or generation happens in these demonstrations; no geometric test MP4 is promoted as generated output. Actual imports retain permission affirmation in the editor.

On compact screens, navigation uses a labeled disclosure button with expanded state, hidden links when closed and Escape focus restoration. FAQs use native disclosures. Reduced-motion mode disables transitions; there is no autoplay, scrolling animation or video download. The artwork is vector-native and small, so the page needs no large media poster or background video.

## Loading boundaries

`main.tsx` imports only the selected route entry. The homepage imports tokens, primitive styles, its layout, icons and original vector artwork. Firebase/Auth, application routes, the saved canvas and Konva are not initialized by landing on `/`. Legacy application CSS moved to `App.tsx`, with the design lab importing it for its existing study baseline. Shared `base.css` only supplies page background and zero body margin.

Navigation between marketing and application uses real document links. This keeps initial loading independent and supports ordinary browser back/forward and direct route refresh. Studio-to-home navigation retains the existing leave guard and before-unload protection. Project authorization and private asset delivery remain server enforced.

## Assets and metadata

Original artwork is now shared from `apps/web/src/ui/SceneArtwork.tsx`; the design study reuses it. `public/favicon.svg` is an original vector monogram. `public/social-preview.svg` is the editable source of the 1200×630 PNG card. Re-export with:

```powershell
node scripts/render-social-preview.mjs
```

The script uses the API workspace's existing Sharp dependency. It does not call a model or fetch an asset. Font rendering depends on installed system fonts; inspect the export after regeneration. Source/rights/placement records are in [ui-assets.json](ui-assets.json).

The HTML head contains a title, description, theme color, icon, Open Graph title/description/image metadata and a large Twitter card hint. It contains no private project content. **Before deployment**, once the actual public origin is known, set a matching absolute canonical URL, `og:url` and absolute `og:image` URL in `apps/web/index.html`, then verify link previews from that deployed origin. The current root-relative image is a local placeholder for origin resolution, not evidence of a successful external social unfurl. Do not invent a live domain.

The page has not been deployed, and search indexing/social crawler results are not verified. Artcraft's external visual inspection remains the previously documented U1 browser-connection blocker; no copied layout/assets or exact visual match is claimed.

See [validation results](ui-upgrade-results.md) and [screenshots](ui-u2/README.md).
