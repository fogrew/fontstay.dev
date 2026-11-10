# Performance

## Budget

`pnpm perf` (part of `pnpm verify`, runs after the build) sums the gzip size of the JavaScript a page loads up front: the island entry points (`component-url`, `renderer-url`), page scripts and everything they import statically. Lazy chunks (dynamic `import()`) and the font parser worker are not counted. Limits live in `scripts/perf-budget.json` and are about 10% above the measured size, so a regression fails the build:

| Page                                 | Measured | Budget |
| ------------------------------------ | -------- | ------ |
| `/en/` (generator)                   | 147.9 kB | 200 kB |
| `/en/fonts/` (catalog)               | 43.8 kB  | 48 kB  |
| `/en/presets/`                       | 31.3 kB  | 34 kB  |
| `/en/import/` (site import receiver) | 2.4 kB   | 4 kB   |

Raise a limit only with a justification in the PR. The limits were raised for the three-column layout, the custom dropdown (shared by every page), the catalog filters, the all-fonts overview and the layer model with its icon controls (#218), the WordPress and Fontaine export generators (#181), the device picker with grouped dropdown options (#367), the diff-based share link with its preview state (#366), the site appearance control (#494), and the resizable sidebars with their splitter (#549), whose shared code adds about 1 kB to every page. The messages are not part of the JavaScript: each locale is a JSON file (`messages/<locale>.json`, a hashed asset) that a page fetches for its own language only, so adding a language costs no initial JavaScript.

## What is lazy

- **browserslist** (about 130 kB): loaded when the audience editor resolves a query.
- **Font parser**: a dedicated worker chunk, started on the first upload.
- **Bold and italic metrics** (`os-fonts/data/variants.json`, about 580 kB raw): imported when a style other than regular is used.
- **Syntax highlighting** (Shiki core, the JavaScript regex engine and one grammar per language): loaded when a code block first renders.
- **Google Fonts catalog** (about 160 kB raw): imported when the picker is first opened.
- **Language requirements** (`font-details/data/languages.json`, about 20 kB raw): imported when the font details panel mounts.
- **Unicode blocks and coverage map**: part of the generator chunk, small.

## Hydration

The generator and the catalog table are single islands hydrated with `client:load`; they are the page. The presets list hydrates only for the copy buttons. Static pages (font details) ship no JavaScript besides the header toggle.

## Ideas not done yet

- Split the base `metrics.json` (200 kB raw) by script.
- Hydrate the audience editor on first open instead of on load.
- Measure Core Web Vitals of the deployed site (Lighthouse CI against the preview).
