# font-license

Pure license analysis of a loaded font from its name table (copyright, trademark, license description and URL) and the OS/2 `fsType` embedding bits. `analyzeLicense` returns the recognised license (SIL OFL 1.1, Apache 2.0, MIT, Ubuntu Font Licence, CC0 by text and URL), the embedding level (installable, restricted, preview and print, editable), the no-subsetting and bitmap-only bits, any Reserved Font Name statement and the resulting rules for the font kit (#176):

- restricted embedding or bitmap-only: conversion and subsetting are blocked;
- no-subsetting bit: subsetting is blocked;
- OFL with a Reserved Font Name: a subset (modified) font must be renamed;
- unrecognised or missing license: a non-blocking notice, the user stays responsible.

`conversionBlockReason` and `subsettingBlockReason` identify the reason for each blocked action. For a recognised license, `licenseFile` supplies the full standard license text, plus bounded name-table copyright, license description and URL for a later LICENSE file. The actual conversion and subsetting kit remains part of #176.

All name-table fields are limited to 2000 UTF-16 code units and stripped of control characters before matching or returning them, including calls made directly to the pure API. Explicit older OFL and Apache versions, and conflicting text/URL license identities, remain unknown rather than receiving the wrong standard text.

Everything runs in the browser from data already parsed by `font-metrics`.

The preview-and-print and editable embedding levels are shown but block nothing; only restricted embedding, the no-subsetting bit and the bitmap-only bit do.
