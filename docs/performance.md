# Performance

## Budget

`pnpm perf` (part of `pnpm verify`, runs after the build) sums the gzip size of the JavaScript a page loads up front: the island entry points (`component-url`, `renderer-url`), page scripts and everything they import statically. Lazy chunks (dynamic `import()`) and the font parser worker are not counted. Limits live in `scripts/perf-budget.json` and are about 10% above the measured size, so a regression fails the build:

| Page | Measured | Budget |
|---|---|---|
| `/en/` (generator) | 121.6 kB | 126 kB |
| `/en/fonts/` (catalog) | 37.3 kB | 39 kB |
| `/en/presets/` | 25.7 kB | 27 kB |
| `/en/import/` (site import receiver) | 2.2 kB | 4 kB |

Raise a limit only with a justification in the PR. The limits were raised for the three-column layout, the custom dropdown (shared by every page), the catalog filters, the all-fonts overview and the layer model with its icon controls (#218). The messages are not part of the JavaScript: each locale is a JSON file (`messages/<locale>.json`, a hashed asset) that a page fetches for its own language only, so adding a language costs no initial JavaScript.

## What is lazy

- **browserslist** (about 130 kB): loaded when the audience editor resolves a query.
- **Font parser**: a dedicated worker chunk, started on the first upload.
- **Bold and italic metrics** (`os-fonts/data/variants.json`, about 580 kB raw): imported when a style other than regular is used.
- **Syntax highlighting** (Shiki core, the JavaScript regex engine and one grammar per language): loaded when a code block first renders.
- **Google Fonts catalog** (about 160 kB raw): imported when the picker is first opened.
- **Unicode blocks and coverage map**: part of the generator chunk, small.

## Hydration

The generator and the catalog table are single islands hydrated with `client:load`; they are the page. The presets list hydrates only for the copy buttons. Static pages (font details) ship no JavaScript besides the header toggle.

## Ideas not done yet

- Split the base `metrics.json` (200 kB raw) by script.
- Hydrate the audience editor on first open instead of on load.
- Measure Core Web Vitals of the deployed site (Lighthouse CI against the preview).
