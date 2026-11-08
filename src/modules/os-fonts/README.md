# os-fonts

Which fonts ship with which operating system, as a schema-validated dataset (`data/os-fonts.json`) with a source URL on every entry. Only positive evidence is recorded: a missing entry means the version is unknown, not that the font is absent.

- `lib/model.ts`: types. `lib/validate.ts`: `validateDataset` / `assertDataset` (unit-tested, run against the bundled data).
- `lib/query.ts`: `osAvailability(font, os, dataset)` reports `preinstalled` (all known versions), `partial`, `on-demand` (Windows Feature on Demand) or `unknown`; `fontsAvailableOn` lists fonts per system.

The dataset covers a curated list of fallback-relevant families (`scripts/os-fonts/families.ts`) and is regenerated with `pnpm os-fonts:import` (network access required):

| System   | Versions                                | Source                                                                                                                               |
| -------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Windows  | 7, 8.1, 10, 11                          | Microsoft Learn font lists                                                                                                           |
| macOS    | 10.15, 11 to 26, current                | adrg/os-font-list (MIT) for 10.15, Apple Support "Fonts included with macOS" pages for 11 to 26, Apple system fonts page for current |
| iOS      | current                                 | Apple system fonts page                                                                                                              |
| Android  | 10 to 16                                | AOSP `fonts.xml` at release tags                                                                                                     |
| Linux    | Ubuntu 20.04 to 26.04, Debian 12 and 13 | desktop ISO manifests and the Debian GNOME live image package lists, mapped from package to families                                 |
| ChromeOS | R100 to R150, current                   | `chromeos-fonts` ebuild at release branches and `main`                                                                               |

`inferred: true` on an availability entry marks a status that is not read directly from its source. The Apple Support lists do not separate installed from downloadable fonts, so macOS 11 to 26 entries take `preinstalled` or `on-demand` from the current Apple system fonts page: presence in the release is real, the status is an upper bound. `current` is the latest Apple system fonts page and may be newer than 26. Apple Support pages and the ChromeOS release branches are fetched live, not pinned, so a regeneration can differ if they change.

Gaps (#172): iOS releases before the current one (no per-release Apple source), vendor Android builds, Fedora and other distributions, per-font local names.

## Metrics

`data/metrics.json` holds, per family, the vertical metrics (`hhea`, `typo`, `win`), the local names for `@font-face` `local()` and the glyph advances for Latin, Greek, Cyrillic and common punctuation (code point runs plus an advance array). Only metrics are committed, never font files; each entry records the source file, its SHA-256 and, for downloads, URL and license. Each entry (and each style variant) also carries `ratios`: the HarfBuzz-shaped width of the sample text (`en`, `ru`) over its advance-sum width, computed by `pnpm os-fonts:metrics` with `harfbuzzjs`. The optimizer uses them instead of measuring the visitor's installed fonts, so the result is the same on every machine. `osFontMetrics()` decodes them into `Uint32Array`/`Float64Array` pairs compatible with the fit engine.

`pnpm os-fonts:metrics [extra font dirs...]` regenerates the file with the production parser (`parseFontBuffer`), running it through a Vite server. It searches the system font directories (Windows `%WINDIR%\Fonts`, macOS `/System/Library/Fonts`, `/System/Library/Fonts/Supplemental`, `/Library/Fonts`, Linux `/usr/share/fonts`, plus the extra directories), downloads open-source fonts from pinned URLs (cached in the OS temp directory) and keeps previous entries for fonts it cannot find. Font collections use their first member. Helvetica, Helvetica Neue and Lucida Grande need a macOS run.
