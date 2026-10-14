# Open font sources shortlist (#44)

Checked on 2026-10-14 with `Origin: https://fontstay.dev` requests.

| Source | License | API | CORS | Decision |
|---|---|---|---|---|
| [Fontsource](https://fontsource.org/) | Per font, mostly OFL-1.1 (a few CC0, Apache-2.0, MIT, Unlicense) | `api.fontsource.org/v1/fonts` (2103 fonts, 119 outside Google Fonts) with weights, styles, subsets, license; files on `cdn.jsdelivr.net/fontsource/fonts/<id>@latest/<subset>-<weight>-<style>.woff2` | `*` for both the API and the files | Added: the 119 non-Google fonts (includes foundry releases such as Velvetyne-style fonts); the catalog is bundled, only the file is fetched at run time |
| [Bunny Fonts](https://fonts.bunny.net/) | Mirror of Google Fonts families (same licenses) | Google-compatible css and `/list` (1971 families) | `*` | Skipped: the same families as the Google picker; only the privacy posture differs. Could become a mirror switch for the Google picker |
| [Fontshare](https://www.fontshare.com/) | ITF Free Font License (not OFL) | `api.fontshare.com/v2/fonts` | Only its own origin | Skipped: no browser access and a non-OFL license |
| [Velvetyne](https://velvetyne.fr/), [Collletttivo](https://www.collletttivo.it/), [Open Foundry](https://open-foundry.com/), [The League of Moveable Type](https://www.theleagueofmoveabletype.com/) | OFL or similar, per font | No API; static sites | No CORS | Skipped as direct sources; many of their fonts are already in Fontsource |
| [Font Library](https://fontlibrary.org/) | OFL and similar | No public API found | No CORS | Skipped |

Only the font file download crosses the network, with the host, path, size and time checked, and the file goes through the normal upload validation.
