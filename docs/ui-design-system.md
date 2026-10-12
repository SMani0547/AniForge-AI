# AniForge visual foundation — U1

October 13, 2026 (Pacific/Fiji). These are implemented design studies, not migrated production screens. Run the normal development server or `npm run dev:emulators`, then open **http://127.0.0.1:5173/design**. Query links select a study directly:

- `/design?view=home`: desktop/mobile homepage composition.
- `/design?view=dashboard`: sample project dashboard with searchable samples and selectable empty/loading/error states.
- `/design?view=editor`: blank source editor, sample artwork, properties/shot-plan panels and empty video view.
- `/design?view=components`: interactive component catalogue, including validation and keyboard behavior.

The DEV-only entry does not mount the existing app or initialize Firebase. Production builds exclude the design module. Existing routes continue loading the current application. The study's Open studio/Explore actions switch preview screens; Try drawing/Current app links enter the real application. Samples are never written to Firestore or represented as AI results.

## Visual decisions

The homepage uses editorial scale, a large original illustration and a warm paper-colored direction note. The application uses compact navigation, calm charcoal surfaces, consistent borders and clear selection states. Source drawing is always the first available step. Blue/violet is reserved for a few meaningful actions and artwork accents.

| Token family | Defined values / usage |
| --- | --- |
| Surfaces | `#101114` background, `#191b20` surface, `#23262d` raised controls |
| Text | `#f3f0e9` main text, `#b4b7c1` supporting text |
| Accent | `#bbc4ff` action fill, `#141727` ink on accent, `#dadfff` focus outline |
| States | `#a5e4bc` success, `#ffb4b8` error, `#f2d09a` warning; always paired with text |
| Typography | Installed Inter/Segoe UI/sans-serif; no downloaded font dependency. Display type scales with viewport; body 15px, standard buttons 14px, supporting labels generally 12–13px. Tiny labels are reserved for decorative art metadata. |
| Spacing | 4 / 8 / 12 / 16 / 24 / 32 / 48px named tokens; layouts use larger editorial spacing where appropriate |
| Shape | 8px controls, 16px large panels, selective artwork framing; no universal card grid for marketing |
| Motion | 140ms interaction color transitions; reduced-motion preference removes durations; no autoplay or scrolling effects |

`apps/web/src/ui/tokens.css` scopes values to `.af-theme`. `primitives.css` owns components. The new `design/marketing.css`, `dashboard.css`, `editor.css` and `design-lab.css` separate surface layouts. Legacy `styles.css` remains in use for current routes; this is deliberate staged migration, not a claim that the existing application has been refactored already.

## Interaction contract

| Component | Implemented behavior |
| --- | --- |
| Button / IconButton | Primary, secondary, quiet and destructive styles; native disabled state; 44px default targets; visible keyboard focus. Icons have explicit names. |
| Tooltip | Hover/focus description; Escape dismisses; accessible button name does not depend on tooltip visibility. |
| Field | Persistent label, help/error association, invalid state and disabled state; no placeholder-only labeling. |
| View switch | Native buttons with `aria-pressed`, grouped by an accessible name. This is a view switcher, not an incomplete ARIA tablist. Each control remains keyboard reachable. |
| ActionMenu | Native disclosure with named buttons; Escape closes and returns focus; leaving the disclosure closes it. No unimplemented ARIA menu keyboard contract. |
| Dialog | Native modal, background inertness, explicit Tab/Shift+Tab wrap, Escape close, focus restoration and associated title. |
| Badge / Notice | Text identifies the state; informational status and error alert semantics. Optional dismissible notification remains until dismissed. |
| Skeleton / EmptyState | Announced loading state; stable static placeholder; clear empty-state explanation and a useful action. |

The toolbar in the editor composition is illustrative, not a replacement canvas engine. Its drawing link opens the current functioning playground. Selecting sample layers or editing preview text changes local component state only. Persistence, project imports, autosave and paid AI wiring migrate in later phases with their existing tests.

## Reference observations and limitation

The [Artcraft homepage](https://getartcraft.com/) content/hierarchy review from the planning turn identified a prominent app entry, capability demonstrations and a showcase. AniForge adapts that general progression with original copy/art and its actual workflow. Artcraft's desktop/mobile appearance, typography and motion have **not** been visually verified: the browser tool reported `Browser is not available: iab`, and surface discovery returned no browsers. No observation of its exact colors, transitions or layout is claimed. That U1 reference task stays unchecked for a later browser-connected review.

Local Playwright screenshots are separate, executable browser evidence for AniForge. See [U1 results](ui-upgrade-results.md) and [screenshot index](ui-u1/README.md). These do not replace a visual review of the external reference.

## Migration order

U2 builds the full public `/` homepage using these tokens/components and adds the remaining FAQ/showcase/metadata content. U3 migrates authenticated projects. U4 migrates the saved editor while preserving state ownership. U5 migrates generation/revisions. Component adoption must retain current access control, error recovery, import affirmation, paid consent and source/video separation. No cloud credentials are needed to review this foundation.
