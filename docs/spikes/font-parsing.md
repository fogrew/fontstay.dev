# Spike: font parsing in a Web Worker (#8)

Goal: pick a parser for woff2/woff/ttf/otf that runs in a worker and exposes `OS/2`, `hhea`, `cmap` and glyph advances.

## Candidates

|                             | fontkit 2.0.4 | `@capsizecss/unpack` 4.0.1   | fontkitten 1.0.3             | opentype.js 2.0.0                                                                 |
| --------------------------- | ------------- | ---------------------------- | ---------------------------- | --------------------------------------------------------------------------------- |
| License                     | MIT           | MIT                          | MIT                          | MIT                                                                               |
| Browser bundle (min / gzip) | 357 / 145 KB  | 244 / 95 KB                  | 241 / 93 KB                  | 240 / 66 KB                                                                       |
| woff2                       | yes           | yes                          | yes                          | no, needs an external decompressor (wawoff2's decompress-only binding is ~323 KB) |
| woff / ttf / otf            | yes           | yes                          | yes                          | yes                                                                               |
| cmap + per-glyph advances   | yes           | no (aggregated metrics only) | yes (fontkit-compatible API) | yes                                                                               |
| `OS/2`, `hhea`, names       | yes           | yes                          | yes                          | yes                                                                               |

Measured on Inter (latin 23 KB, cyrillic 7.5 KB) and Noto Sans JP variable (CJK subset, 81 KB), Node 26: parse + average advance over the whole cmap takes 3–36 ms (first call includes woff2 decompression).

## Findings

- `@capsizecss/unpack` is a thin layer over fontkitten and returns a single Latin-weighted `xWidthAvg`. On a Cyrillic-only file it reports 1226 for "latin" (the font has no Latin glyphs), which is meaningless. We need per-script, per-language weighted averages, so we need raw cmap + advances.
- opentype.js 2 cannot read woff2 without extra WASM; rejected.
- fontkit and fontkitten expose the same API (`create(buffer)`, `characterSet`, `glyphForCodePoint(cp).advanceWidth`, `ascent`/`descent`/`lineGap` from hhea, `['OS/2']` with `fsSelection.useTypoMetrics`, `capHeight`, `xHeight`). fontkitten is 1.5x smaller in gzip.
- Variable fonts: the default instance is parsed (Noto Sans JP reports "Thin"). Weight-specific metrics need explicit variation handling; out of scope for the first version (use the default instance, document it).

## Decision

Use **fontkitten** directly (not `@capsizecss/unpack`), inside a dedicated Web Worker, and compute our own metrics from cmap + advances.

## Worker RPC sketch

Superseded by the implementation in `modules/font-metrics` (#11, PR #56). The request carries only the buffer (no `id`, `limits` or error `message`). Shape of the result:

```ts
type FontParseResult =
  | { ok: true; font: FontMetrics }
  | {
      ok: false;
      error: {
        code:
          | 'too-large'
          | 'invalid-font'
          | 'unsupported-format'
          | 'timeout'
          | 'worker-error'
          | 'busy'
          | 'disposed';
      };
    };

interface FontMetrics {
  names: { family: string | null; fullName: string | null; postscript: string | null };
  unitsPerEm: number;
  hhea: { ascent: number; descent: number; lineGap: number }; // descents keep the font's sign
  typo: { ascent: number; descent: number; lineGap: number; useTypoMetrics: boolean } | null;
  win: { ascent: number; descent: number } | null; // positive descent
  capHeight: number | null; // absent in old OS/2 versions
  xHeight: number | null;
  codePoints: Uint32Array; // sorted cmap, for unicode-range
  advances: Float64Array;
  isVariable: boolean;
}
```

- TrueType collections are rejected as `unsupported-format`.
- `timeout` is produced by the main-thread watchdog that terminates the worker, never by the worker itself.
- The typed promise-based client lives in `modules/font-metrics`, not `common/lib`. The size limits and the watchdog reduce denial-of-service exposure; decoder allocation hardening is tracked in #55. Font strings are treated as plain text everywhere.
