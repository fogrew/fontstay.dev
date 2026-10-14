# Market research: tools around web fonts (#171)

Checked on 2026-10-14. Sources are linked inline; facts that could not be verified are marked.

## 1. Similar tools and what they offer that we do not

| Tool | What it does | Gap in fontstay.dev |
|---|---|---|
| [Fallback Font Generator](https://screenspan.net/fallback) (in CREDITS) | Upload a brand font, pick a system fallback, tune size, ascent, descent and line gap by hand, overlay preview | We cover this and add auto-fit, per-system stacks, audience, shift prediction |
| [CSS Font Stack](https://cssfontstack.com/), Aback Tools (in CREDITS) | Curated web-safe stacks and per-OS availability | Covered by presets and the system fonts catalog |
| [Everything Fonts](https://everythingfonts.com/) (in CREDITS) | `@font-face` generator, conversions between 20+ formats, glyph viewer, Unicode map, previews on backgrounds | Conversions, glyph viewer and previews are missing (#101) |
| [Transfonter](https://transfonter.org/) | Converts TTF/OTF/WOFF/WOFF2/SVG to web formats, subsets by language or Unicode range, fixes vertical metrics, base64, `font-display`, ZIP kit with CSS and demo | Conversion, subsetting and the kit download are missing; we already compute `unicode-range` and vertical metrics |
| [Wakamai Fondue](https://wakamaifondue.com/) | Reads one font and shows styles, character set, languages, OpenType features, variable axes, colour palettes, and generates CSS | An OpenType features, axes and languages panel is missing (parsing is already done by fontkitten) |
| [Capsize](https://seek-oss.github.io/capsize/), [Fontaine](https://github.com/unjs/fontaine), `next/font` | Metric-based fallbacks as libraries and framework integrations ([overview](https://developer.chrome.com/blog/framework-tools-font-fallback)) | We export for Next, Nuxt, Astro and Tailwind; no CLI or library for build pipelines |
| [Font Style Matcher](https://meowni.ca/font-style-matcher/) | Manual overlay of a web font and a fallback | Covered by the overlay and the layer tools |

Where fontstay.dev is ahead: per-OS and per-audience stacks with one shared fallback, layout shift prediction and device measurement, per-script fits, several fonts at once, no backend.

## 2. More font formats

[onlinefontconverter.com/formats](https://onlinefontconverter.com/formats) lists 22 formats. Grouped by what a browser can do without a server:

- **Pure JavaScript, small.** TTF and OTF to and from WOFF: a WOFF is the sfnt tables each compressed with zlib, and `CompressionStream('deflate')` produces zlib data in all current browsers. TTC member extraction already exists for uploads. EOT (an IE header around a TTF) and SVG fonts are legacy; read-only SVG import is the most that makes sense.
- **WebAssembly.** WOFF2 needs a Brotli encoder with the glyf/loca transform for a good ratio. `CompressionStream('brotli')` exists in Safari 18.4 and Firefox 147 but not in Chrome ([MDN compat data](https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream/CompressionStream), Chrome bug 463397980), so a wasm build of Google's woff2 is needed: [wawoff2](https://www.npmjs.com/package/wawoff2) (MIT, 1.3 MB unpacked), [woff2-encoder](https://www.npmjs.com/package/woff2-encoder) (MIT) or [fonteditor-core](https://github.com/kekee000/fonteditor-core) (TTF, OTF, WOFF, WOFF2, EOT, SVG in the browser). [Kombu](https://github.com/bashi/kombu) is an existing app that converts ttf, otf, woff and woff2 fully in the browser with wasm in a Web Worker. Subsetting uses [harfbuzzjs](https://www.npmjs.com/package/harfbuzzjs) (hb-subset, MIT, 1.3 MB unpacked).
- **Out of scope.** PostScript Type 1 (PFA, PFB, PS), Type 3 (PT3), Type 42, metrics files (AFM, PFM, TFM), FON, SUIT, DFONT, UFO and SFD sources. They need FontForge-class tooling and belong to other audiences.

**Can conversion run in a Web Worker without a backend?** Yes. TTF/OTF to WOFF and WOFF/WOFF2 to TTF are cheap; TTF/OTF to WOFF2 and subsetting are feasible with lazily loaded wasm in the existing worker setup. Costs: the wasm download only when the user asks (no effect on the initial bundle), and `script-src 'wasm-unsafe-eval'` in the CSP, which is a relaxation that must be justified (it allows compiling WebAssembly, not `eval`). Recommendation: WOFF, WOFF2 and subsetting, delivered as "download the font kit" next to the CSS export.

## 3. WebMCP

[WebMCP](https://github.com/webmachinelearning/webmcp) lets a page register tools (name, description, JSON schema, `execute`) for agents with `document.modelContext.registerTool(...)`; a declarative form-based API is explored. Status per the [implementation status](https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md): origin trial in Chrome 149 and Edge 150, a `about:flags#enable-webmcp-testing` flag for development, experimental in Brave, supported in ChatGPT Desktop, no shipped support in Firefox or Safari. The API surface changed during 2026 (earlier previews used `navigator.modelContext`), so expect more changes.

Fit for fontstay.dev: the work is all local and deterministic, which suits tools such as `analyze_font`, `suggest_fallbacks`, `set_audience`, `get_export`, `measure_layout_shift`, wrapping functions that already exist. Privacy is unchanged (no network). Recommendation: an experimental, feature-detected module (~100 lines) after the core features, with the tool list documented; do not depend on it. A larger payoff for agents and CI is a Node CLI and MCP server built from the same engine (see section 5).

## 4. Generic families beyond serif, sans-serif and monospace

CSS defines more generic families: `cursive`, `fantasy`, `system-ui`, `ui-serif`, `ui-sans-serif`, `ui-monospace`, `ui-rounded`, `math`, `emoji`, `fangsong` (our CSS export already accepts them). Google Fonts has five categories: Sans Serif, Serif, Monospace, Display, Handwriting.

- **`cursive`**: worth adding for Handwriting fonts. It is the semantically right last resort, and system script fonts with measurable metrics exist (Comic Sans MS, Segoe Script, Brush Script MT, Apple Chancery, Snell Roundhand, Bradley Hand, Marker Felt). What `cursive` resolves to differs by browser, OS and settings (not verified per platform), which is exactly why an adjusted named fallback in front of it helps. Needs dataset entries and metrics measured on Windows and macOS.
- **`fantasy`**: skip. It has no stable meaning or default font; Display fonts in Google's taxonomy are mostly heavy sans or serif faces, so the right choice is the nearest of sans-serif or serif, which the user can already set per font.
- **Display**: keep mapping to sans-serif or serif by the font's detected style, with a hint in the UI.
- **`system-ui` and friends**: irrelevant as a terminal family for brand fonts; `math`, `emoji`, `fangsong` are niche.

## 5. Recommended follow-ups

1. Font kit: convert in the browser (WOFF, WOFF2), subset, download a ZIP with `@font-face` CSS (Transfonter-like), reusing coverage and `unicode-range`.
2. Font details panel: OpenType features, variable axes, languages, name table (Wakamai Fondue; overlaps #101).
3. A Node CLI and library from the engine, plus an MCP server for agents and CI.
4. Experimental WebMCP tools.
5. `cursive` kind for handwriting fonts.
6. More export formats: WordPress `theme.json`, Fontaine and Vite config.
