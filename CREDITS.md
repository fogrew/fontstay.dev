# Credits

## Inspiration

- [Fallback Font Generator](https://screenspan.net/fallback) by Brian Louis Ramirez — live preview of adjusted fallback fonts.
- [Font Fallback Stack Generator](https://abacktools.com/tools/design/font-tools/font-fallback-stack-generator) by Aback Tools — curated stack presets.
- [CSS Font Stack](https://cssfontstack.com/) — font availability per operating system.
- [Everything Fonts](https://everythingfonts.com/) — font inspector ideas: `@font-face` syntax and browser support, licenses and specifications, colour and background previews, waterfall, glyph viewer, Unicode map and glyph coverage.

## Data

| Source | Used for | License |
|---|---|---|
| [@capsizecss/metrics](https://github.com/seek-oss/capsize/tree/master/packages/metrics) | System and Google Fonts metrics | MIT |
| [adrg/os-font-list](https://github.com/adrg/os-font-list) | Seed of fonts per OS version | MIT |
| [Modern Font Stacks](https://github.com/system-fonts/modern-font-stacks) | Presets, availability cross-check | CC0-1.0 |
| [Browserslist](https://github.com/browserslist/browserslist) | Audience queries | MIT |
| [caniuse-lite](https://github.com/browserslist/caniuse-lite) / [Can I use](https://caniuse.com/) | Browser usage data | CC BY 4.0 |
| [Baseline icons](https://github.com/web-platform-dx/baseline-status) (`baseline-icon.js`) | Baseline logo next to every mention of Baseline | Apache-2.0 |
| [baseline-browser-mapping](https://github.com/web-platform-dx/baseline-browser-mapping) | Baseline queries | Apache-2.0 |
| [Microsoft Learn: Windows 10 and 11 font lists](https://learn.microsoft.com/en-us/typography/fonts/windows_11_font_list) | Font availability on Windows (preinstalled vs Feature on Demand) | Microsoft documentation, facts only |
| [Apple: System Fonts](https://developer.apple.com/fonts/system-fonts/) | Font availability on current macOS and iOS | Apple documentation, facts only |
| [AOSP `fonts.xml`](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/data/fonts/fonts.xml) (tags android-10 to android-16) | Fonts shipped with Android | Apache-2.0 |
| [Chromium OS `chromeos-fonts` ebuild](https://chromium.googlesource.com/chromiumos/overlays/chromiumos-overlay/+/refs/heads/main/chromeos-base/chromeos-fonts/) | Font packages installed on ChromeOS | Package names only (BSD-3-Clause) |
| [Ubuntu desktop ISO manifests](https://releases.ubuntu.com/) (20.04, 22.04, 24.04, 26.04) | Font packages installed by default on Ubuntu desktop | Package names only |
| [Debian GNOME live image package lists](https://cdimage.debian.org/cdimage/archive/) (12.15.0, 13.6.0) | Font packages installed by default on Debian desktop | Package names only |
| Font files read to extract metrics (nothing is redistributed): [google/fonts](https://github.com/google/fonts) (Roboto, Noto Sans, Noto Serif, Lato, Arimo, Tinos, Cousine, Carlito, Caladea: OFL-1.1; Ubuntu, Ubuntu Mono: UFL-1.0), [DejaVu fonts 2.37](https://github.com/dejavu-fonts/dejavu-fonts) (Bitstream Vera licence), [Liberation fonts 2.1.5](https://github.com/liberationfonts/liberation-fonts) (OFL-1.1), Droid Sans Mono from [AOSP](https://android.googlesource.com/platform/frameworks/base/+/refs/tags/android-10.0.0_r1/data/fonts/) (Apache-2.0), and the Microsoft fonts installed with Windows | Vertical metrics and glyph advances in `src/modules/os-fonts/data/metrics.json` | Facts about the fonts; font files are not committed |
| [modern-font-stacks](https://modernfontstacks.com/) (Dan Klammer, MIT) | Inspiration for the preset categories (neo-grotesque, humanist, transitional, ...); the stacks are our own selection | Ideas only, no code copied |
| [Google Fonts metadata](https://fonts.google.com/metadata/fonts) and [CSS API](https://developers.google.com/fonts/docs/css2) | Family catalog (names, categories, subsets, styles) and, at run time, the user-chosen font download | Catalog facts; fonts are OFL/Apache/UFL and are not redistributed |
| [Fontsource API](https://fontsource.org/docs/api) (`api.fontsource.org`) and [jsDelivr](https://www.jsdelivr.com/) | Catalog of the non-Google open fonts (names, categories, weights, styles, subsets) and, at run time, the user-chosen font download from `cdn.jsdelivr.net/fontsource/fonts/` | Catalog facts; fonts are OFL-1.1 (a few CC0, Apache-2.0, MIT, Unlicense) and are not redistributed |
| [Google Fonts CSS API](https://developers.google.com/fonts/docs/css2) subset `unicode-range` values | Definitions of the named subsets (latin, cyrillic, greek, ...) | Facts (numeric ranges) |
| [Unicode Character Database `Blocks.txt`](https://www.unicode.org/Public/16.0.0/ucd/Blocks.txt) | Block names and ranges for the glyph coverage table and map | Unicode License v3 |
| [MDN browser-compat-data](https://github.com/mdn/browser-compat-data) | `@font-face` descriptor support | CC0-1.0 |
| [StatCounter Global Stats](https://gs.statcounter.com/) via [Wikipedia: Usage share of operating systems](https://en.wikipedia.org/wiki/Usage_share_of_operating_systems) | Default desktop OS split (worldwide desktop, June 2026: Windows 62.16%, macOS 14.58%, Linux 3.09%, ChromeOS 1.42%, unknown 18.75% redistributed proportionally) | CC BY-SA 3.0 |
| [Capsize unpack 4.0.1](https://github.com/seek-oss/capsize/tree/master/packages/unpack) | English/Latin frequency weights, sampled from English Wikinews abstracts | MIT; underlying Wikinews content CC BY 2.5 |
| [UD Russian GSD](https://github.com/UniversalDependencies/UD_Russian-GSD/tree/0f34b7362ac3c3facd1d6ff4b876d241bb15793e) by Ryan McDonald, Vitaly Nikolaev and Olga Lyashevskaya | Cyrillic character counts derived from 3,850 training sentences; corpus text is not shipped | CC BY-SA 4.0 |

## Tooling

- [Paraglide JS](https://github.com/opral/paraglide-js) by inlang — message compilation and i18n routing (MIT).
- [Dependabot](https://docs.github.com/en/code-security/dependabot) — automated dependency update PRs (GitHub, config only).
- [Cloudflare Workers static assets headers](https://developers.cloudflare.com/workers/static-assets/headers/) and [Astro Content Security Policy](https://docs.astro.build/en/reference/configuration-reference/#securitycsp) — `_headers` delivery and hashed CSP; [MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP) and [Permissions-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy) — policy design.
- [browserslist-ga](https://github.com/browserslist/browserslist-ga), [browserslist-ga-export](https://github.com/browserslist/browserslist-ga-export), [browserslist-plausible](https://github.com/browserslist/browserslist-plausible) and the [custom usage data format](https://github.com/browserslist/browserslist#custom-usage-data) — linked from the statistics import (MIT).
- [git-cliff](https://github.com/orhun/git-cliff) — changelog generation from Conventional Commits (MIT OR Apache-2.0).
- [fontkitten](https://github.com/delucis/fontkitten) — local font parsing in a Web Worker (MIT).
- [fontkitten test fonts](https://github.com/delucis/fontkitten/tree/43c1cfc596292fc59ef3670251a885239c7c625e/packages/fontkitten/test/data) — Source Sans Pro (Adobe), Fira Sans (Carrois Corporate / bBox Type) and Mada (Khaled Hosny) fixtures (SIL OFL 1.1; licenses included in `tests/fixtures/fonts`).

## Methodology

- [FEOD — Fractal Entity Oriented Design](https://fractal-oriented.tech/) — project architecture.
- [Vite Web Workers](https://vite.dev/guide/features.html#web-workers) — bundling dedicated module workers.
- [MDN Worker.terminate](https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate) — watchdog cancellation of parsing.
- [FontTools](https://github.com/fonttools/fonttools) — independent fixture metric checks (MIT).
- [OpenType OS/2 specification](https://learn.microsoft.com/en-us/typography/opentype/spec/os2) — legacy table lengths and vertical metric fields.
- [CSS Fonts Level 5](https://drafts.csswg.org/css-fonts-5/#descdef-font-face-size-adjust) — scaling metric overrides and nonnegative descriptors.
- [Capsize core](https://github.com/seek-oss/capsize/blob/master/packages/core/src/createFontStack.ts) (MIT) and [Fontaine](https://github.com/unjs/fontaine/blob/main/packages/fontaine/src/css.ts) (MIT) — fit formulas; frozen Capsize 4.1.3 reference outputs with metrics 4.3.0.
- [FreeType SFNT metrics selection](https://github.com/freetype/freetype/blob/master/src/sfnt/sfobjs.c) — explicit `freetype` vertical metric policy (FreeType License / GPLv2).
- [CSSOM string serialization](https://drafts.csswg.org/cssom/#serialize-a-string) — CSS string escaping, extended to escape `<` for HTML style embedding.
- [CSS Fonts Level 4](https://drafts.csswg.org/css-fonts-4/#src-desc) and [Level 5](https://drafts.csswg.org/css-fonts-5/#descdef-font-face-size-adjust) — quoted family/local names and metric descriptors.
- [WCAG 2.2 non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) and [relative luminance](https://www.w3.org/TR/WCAG22/#dfn-relative-luminance) — independent control-boundary contrast checks alongside axe.
- [Biome suppressions](https://biomejs.dev/analyzer/suppressions/) — narrowly scoped exceptions for keyboard focus on tab panels and scrollable code.
- [WAI-ARIA Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) — tab semantics and roving keyboard focus.
- [Preact hooks](https://preactjs.com/guide/v10/hooks/#useid) — stable server/client IDs and local component state.
- [MDN light-dark](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/light-dark) and [forced colors](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/forced-colors) — theme and system-color handling.
- [MDN Clipboard.writeText](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText) — explicit copy actions with accessible failure feedback.
- [Simple Icons](https://simpleicons.org/) (CC0 1.0) — brand marks for browsers, systems, GitHub, Google Fonts, CSS, HTML, Tailwind CSS, Next.js, Nuxt and Astro in `public/brands.svg`. The marks belong to their owners.
- [Font Awesome Free brands](https://fontawesome.com/license/free) (icons under CC BY 4.0, Fonticons, Inc.) — the Windows and Edge marks and the save, share, download, copy and forget action icons in `public/brands.svg`.
- [Browserslist logo](https://github.com/browserslist/browserslist) by Anton Popov (MIT) — the Browserslist mark in `public/brands.svg`.
- [WAI-ARIA APG select-only combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/) — keyboard and ARIA model of the custom dropdown.
- [Shiki](https://shiki.style/) (MIT) — syntax highlighting of the export code: the JavaScript regex engine and the CSS, HTML, JavaScript, TypeScript and Markdown grammars with a CSS-variables theme, rendered as class names.
