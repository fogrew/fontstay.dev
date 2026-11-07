# fontstay

Metric-adjusted fallback fonts for web fonts, from the [fontstay.dev](https://fontstay.dev) fit engine. A Node library and a CLI for build pipelines and CI: it parses a font file, fits fallbacks from the system fonts of each operating system in your audience and prints the `@font-face` rules (`size-adjust`, `ascent-override`, `descent-override`, `line-gap-override`), the same way the web app does. No DOM, no network access.

Requires Node 24 or newer. Built from this repository with `pnpm cli:build` into `packages/fontstay/dist/`.

## CLI

```sh
fontstay fit font.woff2 --systems windows,macos --audience 'defaults'
fontstay fit Inter.woff2 -o fallbacks.css
fontstay fit regular.woff2 bold.woff2 --format tailwind
```

| Option | Meaning |
|---|---|
| `-s, --systems <list>` | Systems to fit: `windows`, `macos`, `ios`, `android`, `linux`, `chromeos`. Default: every system with a share of at least 1% in the audience. Shares stay those of the whole audience, as when a system is switched off in the app. |
| `-a, --audience <query>` | [Browserslist](https://browsersl.ist) query, including `baseline widely available`. `os <system>` and `not os <system>` parts select systems like the app. Overrides the project config. |
| `-f, --format <format>` | `css` (default), `variables`, `tailwind`, `next`, `nuxt`, `astro`, `wordpress`, `fontaine`, `preload`, `loading`. |
| `-k, --kind <kind>` | Generic family of the fallbacks: `sans-serif`, `serif`, `monospace`, `cursive`. Default: detected from the font. |
| `--locale <en\|ru>` | Frequency profile of the fit. `ru` applies to fonts that cover Cyrillic. Default: `en`. |
| `--unicode-range` | Add `unicode-range` with the glyphs each font covers. |
| `--no-scripts` | Do not emit separate faces for Cyrillic and Greek. |
| `-o, --out <file>` | Write to a file instead of stdout. |
| `--json` | Print a JSON report: the output file, the fallbacks chosen per system, the audience shares. |

Several font files are merged into one stylesheet, as in the app. Warnings (low glyph overlap, systems without fallback fonts) go to stderr. Exit codes: `0` success, `1` failure (unreadable or invalid font, invalid audience), `2` usage error.

By default, `fontstay fit` finds the project's Browserslist config from the current working directory, including `.browserslistrc` and the `browserslist` field in `package.json`. If there is no project config, it uses `baseline widely available`. Pass `--audience` to use a specific query instead of the project config; `--systems` can further restrict the systems fitted.

The output is byte-identical to the app's CSS export for the same font and audience: the same fallbacks, order, scripts and `unicode-range`, and the same optimizer (it nudges the sizes and may add a `.fonts-loading` letter-spacing rule). The optimizer is deterministic: it runs a fixed number of evaluations with no time limit and takes its width ratios from HarfBuzz (`harfbuzzjs`, WebAssembly) for the font you pass and from precomputed values for the system fonts, so it does not depend on a browser or on the fonts installed on the machine. `tests/e2e/cli-parity.spec.ts` compares the test fonts with the app and requires identical output.

### Audit split web fonts

```sh
fontstay audit site.css [--json]
```

Reads the `@font-face` rules of CSS files and warns, per family, weight and style, about a web font split in a way that slows text layout: basic Latin (U+20 to U+7E) spread over several files, overlapping `unicode-range` values, and the face with the most glyphs declared before faces that overlap it. Warnings are informational, so the exit code stays `0` (`1` for an unreadable file). Rule numbers are 1-based positions among the `@font-face` rules of the file. `--json` prints `[{ file, rules, issues }]`.

## MCP server

`fontstay mcp` runs a [Model Context Protocol](https://modelcontextprotocol.io) server on stdio, so an agent in an editor can analyze local font files and write the fallback CSS for them. It reads only the font files the agent names, writes nothing and makes no network requests. Protocol versions 2025-11-25, 2025-06-18, 2025-03-26 and 2024-11-05; tools only.

Once the package is published to npm, add it to an editor with:

```json
{
  "mcpServers": {
    "fontstay": { "command": "npx", "args": ["-y", "fontstay", "mcp"] }
  }
}
```

Claude Code: `claude mcp add fontstay -- npx -y fontstay mcp`. Before that, or from a checkout, use `node /path/to/packages/fontstay/dist/bin.js mcp` after `pnpm cli:build`. Relative paths resolve against the directory the editor starts the server in.

| Tool | Input | Result |
|---|---|---|
| `analyze_font` | `path` | Names, weight and style, detected type, vertical metrics, scripts, glyph count, variable axes, OpenType feature tags, license. |
| `suggest_fallbacks` | `paths`, fit options | JSON: the fallback family chosen per system, the audience share of each system, glyph-weight coverage per font, systems without fallbacks. |
| `audit_font_faces` | `paths` (CSS files) | The split-font warnings of `fontstay audit`, one line each, or a note that there are none. |
| `get_css` | `paths`, fit options | The `@font-face` and `font-family` CSS, as in `fontstay fit`. |
| `get_export` | `paths`, `format`, fit options | The same fit as `css`, `variables`, `tailwind`, `next`, `nuxt`, `astro`, `wordpress`, `fontaine`, `preload` or `loading`, then the suggested file name. |

Audience queries that load a shared config or stats file (`extends ...`, `in <package>`) are rejected, and Windows network paths (`\\host\share`) are not read. `paths` takes 1 to 16 files of up to 10 MB (WOFF2, WOFF, TTF, OTF); several files are merged into one result. Fit options mirror the CLI: `audience` (Browserslist query), `systems`, `locale`, `kind`, `unicode_range`, `scripts`. Low glyph overlap and systems without fallback fonts are reported as warnings after the result. Bad input (missing file, invalid font, invalid audience) comes back as a tool error that the agent can read and correct.

The tool names follow the WebMCP set planned in #189. The tools there that keep session state (loaded fonts, `set_audience`, `set_fallback`) have no counterpart: the server is stateless, each call names its files and carries its own audience, and `suggest_fallbacks` returns the resolved audience and system shares. Layout shift (`get_layout_shift`) needs a browser and is not available.

## Library

```js
import { fit, fitFiles } from 'fontstay';
import { readFile } from 'node:fs/promises';

const { css, fonts, shares } = await fit({
  fonts: [{ fileName: 'inter.woff2', data: await readFile('inter.woff2') }],
  audience: 'defaults',
  systems: ['windows', 'macos'],
});

const tailwind = (await fitFiles(['inter.woff2'], { format: 'tailwind' })).file.text;
```

`auditFontFaces(css)` and `auditCssFiles(paths)` return `{ file, rules, issues }` for CSS text or files, and `describeIssue(issue)` writes an issue as one line.

`fit(options)` takes font bytes, `fitFiles(paths, options)` reads files. Both return `{ css, file, fonts, shares, systems, uncovered, audience }`; `fonts` lists the fallback family picked for each system. Failures throw `FitRunError` (`invalid-audience`, `no-systems`, `no-fit`) or `FontParseError`. Types are in [`index.d.ts`](index.d.ts).

The fit uses raw glyph advances weighted by character frequency, with no shaping, and chooses among the system fonts that the fontstay dataset knows. See `src/modules/fallback-fit/README.md` for the method and its limits.
