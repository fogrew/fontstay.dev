# Font fixtures

Unmodified OFL-licensed test fonts from [fontkitten](https://github.com/delucis/fontkitten/tree/43c1cfc596292fc59ef3670251a885239c7c625e/packages/fontkitten/test/data).

- Source Sans Pro: OTF, WOFF, WOFF2; license in `OFL.txt`.
- Fira Sans: TTF with USE_TYPO_METRICS; license in `FiraSans-OFL.txt`.
- Mada: variable TTF, default weight axis 520; license in `Mada-OFL.txt`.

Reference metrics for the TTF, OTF and WOFF files were checked directly with FontTools 4.63.0 against the fixture tables (`head`, `hhea`, `OS/2`, `cmap`, `hmtx`). WOFF2 is checked against the Source Sans Pro reference values. These files are test assets, never included in the production site or fallback metrics dataset.

`Mada-VF.woff`, `Mada-VF.woff2` and `Mada-VF-hmtx.woff2` are FontTools 4.63.0 conversions of `Mada-VF.ttf` with no table changes; the last one also transforms `hmtx`. The font has `gvar` and no `HVAR`.
