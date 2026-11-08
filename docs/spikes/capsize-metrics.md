# Spike: `@capsizecss/metrics` coverage (#9)

Goal: find which system fonts and scripts have metrics we can rely on.

`@capsizecss/metrics` 4.3.0 (MIT) contains 1969 fonts, almost all Google Fonts, each with `capHeight`, `ascent`, `descent`, `lineGap`, `unitsPerEm`, `xHeight` and `xWidthAvg`, per weight/style variant.

## Scripts

Only two subsets exist across the whole collection: `latin` and `thai`. Each font has an `xWidthAvg` per subset (`subsets.latin`, `subsets.thai`) weighted separately (the latin one by a fixed Latin letter-frequency table). There is nothing for Cyrillic, Greek, Arabic, CJK, etc., and no way to weight by a target language.

## System fonts

| OS          | Present (of the examples checked)                                                | Missing (examples)                                                                                                                                      |
| ----------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows     | arial, courierNew, georgia, segoeUI, tahoma, timesNewRoman, trebuchetMS, verdana | Calibri, Cambria, Consolas, Segoe UI Variable, Arial Black/Narrow, Impact, Lucida Console, Palatino Linotype, Microsoft YaHei, Yu Gothic, Malgun Gothic |
| macOS / iOS | helvetica, helveticaNeue, appleSystem, lucidaGrande                              | SF Pro/Mono, New York, Avenir, Menlo, Monaco, Palatino, Baskerville, Futura, PingFang, Hiragino                                                         |
| Android     | roboto, robotoFlex, robotoMono, notoSans, notoSerif, notoSansMono                | Droid family                                                                                                                                            |
| ChromeOS    | not checked in this spike                                                        | to be covered by the extraction script (#31)                                                                                                            |
| Linux       | ubuntu, ubuntuMono, cantarell, notoSans, notoSerif, carlito, caladea, openSans   | DejaVu, Liberation, FreeFont, Nimbus                                                                                                                    |
| Generic     | none                                                                             | `system-ui`, `sans-serif`, `serif`, `monospace` (resolve to different fonts per OS)                                                                     |

## Conclusions

1. The package is useful as a **cross-check** for Google Fonts and a handful of system fonts, not as the dataset.
2. We need our own metrics format: per face, store the advance of every code point in the scripts we support (Latin, Cyrillic, Greek first; ~400 code points, about 1 KB per face), plus vertical metrics. Averages are then computed at runtime for the chosen language using frequency tables, and the same data feeds the CLS simulator.
3. The extraction script (#31) must read installed font files. Windows fonts can be extracted on this machine; macOS/iOS fonts need a Mac (or the Local Font Access API from a Mac user's browser, to be evaluated); Linux and Android fonts are open and can be downloaded and extracted in CI-free scripts.
4. Only metrics are committed, never font files.
5. Generic families are not fonts; the stack resolver models them as per-OS mappings in the availability dataset (#30).
