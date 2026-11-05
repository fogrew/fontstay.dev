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
| `-a, --audience <query>` | [Browserslist](https://browsersl.ist) query, including `baseline widely available`. `os <system>` and `not os <system>` parts select systems like the app. Default: `baseline widely available`. |
| `-f, --format <format>` | `css` (default), `variables`, `tailwind`, `next`, `nuxt`, `astro`, `wordpress`, `fontaine`, `preload`, `loading`. |
| `-k, --kind <kind>` | Generic family of the fallbacks: `sans-serif`, `serif`, `monospace`, `cursive`. Default: detected from the font. |
| `--locale <en\|ru>` | Frequency profile of the fit. `ru` applies to fonts that cover Cyrillic. Default: `en`. |
| `--unicode-range` | Add `unicode-range` with the glyphs each font covers. |
| `--no-scripts` | Do not emit separate faces for Cyrillic and Greek. |
| `-o, --out <file>` | Write to a file instead of stdout. |
| `--json` | Print a JSON report: the output file, the fallbacks chosen per system, the audience shares. |

Several font files are merged into one stylesheet, as in the app. Warnings (low glyph overlap, systems without fallback fonts) go to stderr. Exit codes: `0` success, `1` failure (unreadable or invalid font, invalid audience), `2` usage error.

The output is the engine's fit: the same fallbacks, order, scripts and `unicode-range` as the app's CSS export for the same font and audience. The app then runs an optimizer that measures text in the browser and nudges the values (and may add a `.fonts-loading` letter-spacing rule); that step needs a browser and a wall-clock budget, so the CLI does not run it and its numbers can differ from the app's by a fraction of a percent. `tests/e2e/cli-parity.spec.ts` compares the test fonts with the app: identical structure and values within 2 points. Making the optimizer shared and deterministic is tracked in #384.

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

`fit(options)` takes font bytes, `fitFiles(paths, options)` reads files. Both return `{ css, file, fonts, shares, systems, uncovered, audience }`; `fonts` lists the fallback family picked for each system. Failures throw `FitRunError` (`invalid-audience`, `no-systems`, `no-fit`) or `FontParseError`. Types are in [`index.d.ts`](index.d.ts).

The fit uses raw glyph advances weighted by character frequency, with no shaping, and chooses among the system fonts that the fontstay dataset knows. See `src/modules/fallback-fit/README.md` for the method and its limits.
