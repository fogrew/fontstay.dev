# Font metrics

`createFontParser()` exposes an asynchronous, browser-only parser. Construct it lazily in client code, call `parse(buffer)`, and call `dispose()` when the owner unmounts. Expected failures are returned as `{ ok: false, error: { code } }`; the UI must translate the code through i18n. No font bytes or metadata are sent over the network.

Accepted formats: single-face TTF, OTF, WOFF and WOFF2. Font collections are rejected. The input limit is 10 MiB, decoded size is capped at 64 MiB, at most 256 tables and 100,000 cmap entries per face are accepted, and the main thread terminates parsing after 5 seconds. The watchdog starts when the worker is created, so it also covers worker start-up.

Untrusted-input defences, applied before and inside the third-party decoder:

- `validate.ts` parses the sfnt, WOFF and WOFF2 headers and table directories itself (bounds, table counts, sums of original and transformed lengths against the decoded cap) before anything reaches fontkitten.
- `patches/fontkitten.patch` (pnpm patch) bounds the WOFF2 Brotli output by the decoded size declared in the table directory, remembers a failed decompression instead of retrying it, and rejects a format 12/13 cmap that declares more than 0x110000 groups, and any format 4/12/13 cmap whose ranges add up to more than 0x110000 code points, before the code point array is built.
- fontkitten inflates each WOFF table into a buffer sized by the table's `origLength`, which `validate.ts` has already checked against the decoded cap.

Measured with the patch: a 57 KB WOFF2 whose Brotli stream expands to 300 MiB while declaring 2 KiB is rejected in about 10 ms with about 10 MB of extra RSS. Without it, a 301-byte WOFF2 allocated about 660 MB, and a 846-byte TTF with 60 overlapping format 12 cmap groups aborted Node with a fatal V8 out-of-memory error before the watchdog could fire. Tests cover both forged inputs. Residual risk: the decoder still allocates up to the validated 64 MiB for one request, and other fontkitten code paths (glyph decoding, variation tables) are only bounded by the input and decoded size caps.

Each request owns a fresh worker, which is terminated on success, error, timeout or disposal. A parser accepts one request at a time; concurrent requests return `busy`. A new request after a failure starts a new worker. The input buffer is **transferred** and becomes detached once parsing starts; validation failures and `busy` preserve it. Keep a separate copy if the font must later be loaded for preview.

The result retains hhea, typo and Windows vertical metrics in font units; hhea/typo descenders retain their original signs. Absent OS/2 metrics and unspecified cap/x heights are `null`. A length-guarded adapter reads the legacy version-zero OS/2 tail omitted by fontkitten 1.0.3; shortened 68-byte tables retain null typo/Windows metrics. USE_TYPO_METRICS is recognized only from OS/2 version 4 onward, as the specification defines the bit from that version; whether browsers also honour it in older tables is not verified and is tracked in #12. The cmap is sorted and deduplicated, with a parallel `Float64Array` of raw glyph advances (values are at most 65535; fractional values are possible in variable fonts). Code points that map to `.notdef` are absent, not substituted. More than 100,000 cmap entries is rejected as `too-large`.

Variable fonts use their default instance and set `isVariable`; choosing variation axes is a later extension. Glyph advances do not include shaping, kerning or language weighting. Per-language averages and browser metric selection belong to #12. This follows the font parsing findings in [PR #54](https://github.com/fogrew/fontstay.dev/pull/54).

Unit tests read OFL fixtures locally. `pnpm test:e2e` additionally builds a separate test-only Astro site and exercises the bundled worker in Chromium, including transferable arrays and a watchdog against an infinite loop. The test site and its fonts are excluded from the production build.

## Font details

`FontMetrics.details` carries what the font details panel shows: the OpenType feature tags of GSUB and GPOS (with the name-table label of `ss01`-`ss20` and `cv01`-`cv99`), the layout script tags, the variable axes and named instances, the name-table strings (version, designer, manufacturer, description, license, URLs, copyright), the colour tables present (COLR, SVG, sbix, CBDT) and the CPAL palettes. fontkitten does not decode GPOS, so `lib/details.ts` reads the script and feature lists of both tables itself with bounds-checked reads; a malformed table loses only its own feature list, and every section falls back to empty instead of failing the parse. Bounds: 1024 feature tags, 128 scripts, 64 axes, 256 instances, 64 palettes of at most 512 colours, name strings cut at 2000 characters.
