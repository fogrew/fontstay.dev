# font-license

Pure license analysis of a loaded font from its name table (copyright, trademark, license description and URL) and the OS/2 `fsType` embedding bits. `analyzeLicense` returns the recognised license (SIL OFL 1.1, Apache 2.0, MIT, Ubuntu Font Licence, CC0 by text and URL), the embedding level (installable, restricted, preview and print, editable), the no-subsetting and bitmap-only bits, any Reserved Font Name statement and the resulting rules for the font kit (#176):

- restricted embedding or bitmap-only: conversion and subsetting are blocked;
- no-subsetting bit: subsetting is blocked;
- OFL with a Reserved Font Name: a subset (modified) font must be renamed;
- unrecognised or missing license: a non-blocking notice, the user stays responsible.

Everything runs in the browser from data already parsed by `font-metrics`.
