# fontstay.dev

Generator of metric-adjusted fallback font stacks with live preview and layout-shift (CLS) estimation. Static [Astro](https://astro.build) site. Scope and roadmap: [`docs/plan.md`](docs/plan.md). Contribution rules: [`AGENTS.md`](AGENTS.md).

## Architecture

Source is organized by [FEOD](https://fractal-oriented.tech/en/) levels under `src/`:

| Level | Path | Role |
|---|---|---|
| `app` | `src/app` | Astro `srcDir`: routes (`src/app/pages`), layouts, styles, i18n wiring. Composes everything below. |
| `pages` | `src/pages` | Page entities, each with a root `index.ts`. Routes in `src/app/pages` render them. |
| `modules` | `src/modules` | Product modules with a root `index.ts` public API. |
| `common` | `src/common` | Reusable entities not tied to a product scenario. |
| `global` | `src/global` | Environment declarations and shims. Never imported by application code. |

Rules: imports follow the [import matrix](https://fractal-oriented.tech/en/reference/import-matrix) and go through an entity's root `index.ts`. Enforced by `pnpm lint:arch` ([`@feod/analyzer`](https://fractal-oriented.tech/en/tools/feod-analyzer)) and by Biome `noRestrictedImports` overrides in `biome.json`.

Known limits of the checks:
- `@feod/analyzer` does not parse `.astro` files. Biome matches `@/` alias imports there, and `pnpm lint:arch` additionally rejects relative path literals in `.astro` files that leave their entity (`scripts/lint-arch.ts`). Keep logic in `.ts`/`.tsx` and use `@/` imports in `.astro` files.
- The Biome rules ban alias imports of an entity's internals, including your own (`@/common/ui/x` from inside `src/common/ui`); inside an entity use relative imports.

Astro treats `src/pages` as the routes folder by default; `srcDir: ./src/app` in `astro.config.mjs` moves routes to `src/app/pages` so that FEOD `pages` can live at `src/pages`.

## Internationalization

[Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) compiles `messages/<locale>.json` into typed message functions (`src/common/i18n/paraglide/`, generated, gitignored). All locales are URL-prefixed (`/en/`, `/ru/`); `/` redirects to the browser's language, falling back to English.

- Use messages through `messagesFor(locale)` from `@/common/i18n`; a missing translation key is a TypeScript error (`catalog.ts`) and a failing unit test.
- Add a language: `pnpm i18n:add <locale>`, then translate `messages/<locale>.json` and run `pnpm lint:fix`. Language names in the switcher come from `Intl.DisplayNames`.

## Development

Requires Node 24 (`.node-version`) and pnpm (`packageManager` in `package.json`).

```sh
pnpm install   # also installs git hooks
pnpm dev
pnpm build
pnpm check     # typecheck
pnpm lint      # Biome
pnpm lint:arch # FEOD boundaries
pnpm test      # unit tests (Vitest)
pnpm test:e2e  # e2e + accessibility (Playwright, axe); first: pnpm exec playwright install chromium
pnpm verify    # lint + architecture + typecheck + unit tests + build + performance budget
pnpm perf      # initial JavaScript budget (after a build)
```

## Features

- Upload WOFF2/WOFF/TTF/OTF/TTC fonts, paste `@font-face` CSS, or pick a Google Fonts family; everything is parsed locally in a worker.
- Per-system fallbacks (Windows, macOS, Linux, ChromeOS, Android, iOS) chosen from a dataset of preinstalled fonts, with `size-adjust` and the vertical overrides fitted automatically and an estimate of the layout shift per browser of your audience.
- Browser support matrix from a browserslist query, usage statistics or a manual system mix.
- Export as CSS, CSS custom properties, Tailwind v4, Next.js, Nuxt Fonts, Astro, JSON, preload tags, a Font Loading API script, or a Markdown impact report.
- Share links (`#s=...`), local persistence of fonts and settings, presets, a system font catalog, a guide.

## Data scripts

Generated data is committed; the scripts need network access (and, for Windows metrics, a Windows machine):

| Script | Output |
|---|---|
| `pnpm os-fonts:import` | `src/modules/os-fonts/data/os-fonts.json` (availability per OS from vendor sources) |
| `pnpm os-fonts:metrics` | `metrics.json` and `variants.json` (glyph advances and vertical metrics) |
| `pnpm compat:build` | `src/modules/audience/data/descriptor-support.json` (MDN browser-compat-data) |
| `pnpm google-fonts:catalog` | `src/modules/font-sources/data/google-catalog.json` |
| `pnpm fontsource:catalog` | `src/modules/font-sources/data/fontsource-catalog.json` |
| `pnpm unicode:blocks` | `src/modules/font-metrics/data/blocks.json` |
| `pnpm og:build` | `public/og.png` (needs Playwright Chromium) |

Every source is listed in [`CREDITS.md`](CREDITS.md), which is also rendered as the Credits page.

## Git workflow

Work happens on issues in `fogrew/fontstay.dev`; see [`AGENTS.md`](AGENTS.md) for the rules in full.

- Branches follow Conventional Branch (`feature/<issue>-<desc>`, `bugfix/...`, `chore/...`, `release/v<semver>`, `hotfix/v<semver>`) off `develop`.
- Commits are [Conventional Commits](https://www.conventionalcommits.org/), GPG-signed. Hooks (lefthook, installed by `pnpm install`): `pre-commit` runs Biome on staged files, the FEOD check and `astro check`; `commit-msg` runs commitlint.
- Merge locally (`git rebase develop <branch>`, then `git merge --ff-only`) and push; do not use the GitHub merge button, which strips signatures.
- Releases: `git switch -c release/v<semver> develop`, `pnpm release <semver>` (bumps `package.json` and stamps `CHANGELOG.md`, generated by git-cliff from the commit history), commit `chore(release): v<semver>`, merge into `main` with `--no-ff`, signed tag `v<semver>`, merge back into `develop`.

## Security and deployment

The site is static and deployed with Cloudflare Workers Builds (`main` is production, other branches get previews such as `develop.fontstay.dev`, which are `noindex`). It runs under a strict Content Security Policy; see [`docs/security.md`](docs/security.md). The only network access is the optional Google Fonts picker. Performance budget and lazy chunks: [`docs/performance.md`](docs/performance.md).
