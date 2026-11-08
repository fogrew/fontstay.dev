# CSS export

`generateFallbackCss` returns `fontFaces` (complete `@font-face` rules) and
`fontFamily` (a declaration to put inside a selector). The target family comes
first, followed by adjusted aliases in input order and one unquoted generic.
Each alias can use multiple ordered `local()` full/PostScript name variants;
exact duplicates are removed. Aliases must be unique, including against the
target family, using case-insensitive comparison.

Adjustment inputs are ratios (`1` = `100%`), structurally compatible with the fit
engine. Percentages use four decimal places with trailing zeros removed. Invalid
or negative values fail; `size-adjust` must stay positive after rounding. The
export range is 0–1,000,000%, with at most 32 faces, 16 local names per face and
256 UTF-16 code units per name. Failures use `CssExportError.code`.

Family names are always quoted, including names matching CSS keywords. Quotes,
backslashes and controls are escaped; `<` is escaped so untrusted names cannot
terminate an HTML style element. NUL, malformed Unicode and blank names are
rejected. The module performs no font loading or DOM mutation; callers choose
where to apply or display its text. Browser CSSOM tests verify retained
descriptors and hostile-name containment, alongside unit snapshots.

This first export covers normal-style, normal-weight faces. Weight/style ranges,
unicode ranges and framework formats belong to subsequent export tasks.

## Self-hosted fonts

`selfHostFontFaces` emits `@font-face` rules (`font-display: swap`) whose `src` points at `/fonts/<file>`; the
generator prepends them for Google Fonts and Fontsource when self-hosting is on (the default). The existing
Download action then returns a zip with the selected export format, `fonts/`, `fonts.css`, a README and one
`licenses/<font-file>.txt` per font file. Uploaded font files are included too. The license entries use the font's
name table and the license API for full OFL-1.1, Apache-2.0, MIT, Ubuntu Font Licence or CC0 text when
recognised. Everything runs in the browser from the already loaded bytes; archive code loads on demand.
