# font-details

`FontDetailsPanel` shows what is inside the loaded font: name table, OpenType features with a short description and a live sample each, variable axes with sliders and named instances, supported languages, colour palettes and generated CSS. The data comes from `FontMetrics.details` (see `font-metrics`). The panel is a lazy chunk (`LazyFontDetails`) so it stays out of the initial JavaScript budget; the languages are derived from the character set.

Ticking a feature or moving an axis updates the preview line and the CSS tab. `buildDetailsCss` writes only deviations from the browser defaults (`isDefaultOn` lists the default-on features): features with an exact CSS equivalent become `font-variant-*` values (`smcp` → `small-caps`, `smcp`+`c2sc` → `all-small-caps`, `liga`+`clig` off → `no-common-ligatures`, ...), conflicting or unmapped ones go to `font-feature-settings`, and axes go to `font-variation-settings` clamped to their range.

The live samples load the font through a `FontFace` built from the uploaded bytes; no data leaves the browser. Feature descriptions are i18n messages (`details_feature_<tag>`); an unknown tag falls back to a generic description.
