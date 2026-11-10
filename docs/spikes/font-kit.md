# Browser font kit design and license gate (#176)

## Status and authorization boundary

This is a design for [#176](https://github.com/fogrew/fontstay.dev/issues/176), not a conversion implementation. At baseline `28d2a3a` (2026-11-07), [#188](https://github.com/fogrew/fontstay.dev/issues/188) is open at medium priority. PRs [#457](https://github.com/fogrew/fontstay.dev/pull/457) and [#482](https://github.com/fogrew/fontstay.dev/pull/482) are merged and provide license detection, UI and rules metadata. The assignment authorizes low-priority work and explicitly excludes silently implementing the remaining medium-priority license scope. The owner must authorize that residual scope before conversion/subsetting ships, either as a prerequisite PR or together with #176. Both issues remain open.

## Existing building blocks

| Capability | Existing implementation | Limit for the new kit |
|---|---|---|
| License recognition and notices | `font-license` root API: `analyzeLicense`, `LicenseInfo` | Computes rules; does not run transformations or enforce them in a kit worker |
| Embedding restrictions | `conversionBlockReason`, `subsettingBlockReason`, `conversionBlocked`, `subsettingBlocked` | Restricted/bitmap-only block both; no-subsetting blocks subsetting only; preview/print and editable are displayed without blocking |
| License text and provenance | `licenseFile` holds standard OFL/Apache/MIT/Ubuntu/CC0 text and bounded name-table metadata | Must be included per output face; unknown/missing licenses have no standard text |
| Reserved Font Names | `renameRequired`, `hasReservedFontName`, `reservedFontNames` | Detection exists; no modified-font internal-name rewrite or verification exists |
| Self-host archive | `export` root `loadSelfHostArchive`, existing original-font archive | Packages original bytes/CSS/license text; this is not a conversion/subsetting license gate. Its README does not supply the new kit's unknown-license responsibility statement |
| ZIP writer | `export` root `createZip`, safe paths/collision checks, 1000 entries/256 MiB limits | Reuse with a tighter font-kit budget; account for all buffers and optional base64 before allocation |
| Parsing worker lifecycle | `font-metrics` root `createFontParser`; `common/lib` worker task helper | Parser transfers/detaches its input and handles one operation per worker; a kit needs its own retained/copy-safe source bytes and bounded task protocol |
| WebAssembly allowance | Generator route already allows same-origin HarfBuzz compilation, documented in `docs/security.md` | No new allowance is needed merely to propose a kit. Any encoder/subsetter must be audited; other routes retain their existing policy |

Read implementation details through entity root APIs. The table names implementation files for reviewers only; it does not authorize deep imports.

## Residual #188 acceptance items (not implemented here)

1. Enforce `conversionBlocked` and `subsettingBlocked` before any encoder/subsetter runs, with translated explanations in the UI and matching worker rejection codes. Recompute from the parsed source inside the worker so the UI cannot bypass it. A disabled button alone is insufficient.
2. Include full recognized license text and copyright for each output font in the ZIP. Preserve original license metadata; do not replace unknown terms with a recognized standard license. Avoid merging different faces' claims by family name.
3. For unknown/missing licenses, show a non-blocking notice and include a plain responsibility statement in the kit README. No mandatory checkbox. Keep all processing local.
4. For an OFL Reserved Font Name, rename the internally modified subset as well as filenames/CSS. Require a valid new family distinct from reserved names, update relevant family/full/PostScript/typographic names and dependent identifiers consistently, and independently reparse the result. If safe renaming cannot be verified, do not emit the subset. Preserve copyright/license and describe the modification in the README. Renaming a file alone does not satisfy this rule.

These are integration responsibilities still required by #188, even though its pure analysis API is implemented. A follow-up owner decision must explicitly cover them; this document does not treat #482 as full completion.

## Proposed implementation sequence after approval

1. **License contract first.** Establish pure kit request/response types and a transformation plan derived from `analyzeLicense`. Define bounded source size, output size, face count, range count and timeout limits before implementing codecs. Test the rule matrix above, including unknown/conflicting licenses, restricted embedding, bitmap-only, no-subsetting, OFL RFN and preview/print/editable. Build the per-face LICENSE/README manifest and rename verification path before enabling downloads.
2. **Dedicated kit worker.** Add a lazy `font-kit` module with a public root API and same-origin module worker, using `runWorkerTask` cancellation, deadline, transfer and response validation patterns. Keep license analysis and transformation planning in the worker. Reuse parser behavior through an explicit public pure API if needed, rather than importing `font-metrics/lib/*`; any refactor requires its own focused tests. Never transfer the only copy used by preview or persistence. Bound decompressed tables, offsets, allocations and output buffers; terminate on cancel/timeout.
3. **WOFF round trip.** Validate sfnt/WOFF signatures, table offsets, checksums, overlapping/truncated tables and compression lengths before conversion. Support the exact TTF/OTF flavors promised by the issue; reject unsupported collections or flavors with a translated message rather than selecting a member silently. Preserve necessary name/license tables and recompute required checksums. Use browser compression only after a feature check; runtime support must be verified rather than assumed from issue prose.
4. **WOFF2 and subsetting.** Evaluate the issue's `wawoff2`/`woff2-encoder` candidates and the already pinned `harfbuzzjs` package for the actual encoder/subset APIs and build artifacts. No dependency is chosen or added by this design. Vet licenses, releases, transitive dependencies, WASM exports, memory limits and browser support, then pin versions and add CREDITS entries. Load code/WASM only on the user's action in the worker. Verify script/range choices against source coverage and retain shaping closure and required variation/color/layout data. Apply the verified RFN rename before returning modified bytes.
5. **Archive and UI.** Compose `fonts/`, per-face `licenses/`, generated `fonts.css` and `README.txt` via the public `export` API with deterministic safe names. CSS references the final renamed family/file and selected `font-display`/actual output `unicode-range`; optional base64 counts toward output limits. Show original/output sizes, selected format/ranges, non-blocking unknown-license notices and specific blocked reasons. All user-visible UI strings use catalogs and explicit locale; controls remain keyboard accessible with an announced settled result, one dropdown at a time, and reduced-motion-aware transitions.
6. **Validation and review before shipping.** Run the gate below and independent parallel code/security/requirements review rounds until clean. The worker handles hostile font bytes and therefore requires the full untrusted-input review loop. No conversion/subsetting download becomes available until license enforcement, RFN rewriting and packaging tests pass together.

The intended boundary is `pages/generator` composing the new module with existing source, coverage and export data through root APIs. The module returns bounded transformed bytes and metadata; the page composes download/UI state. No backend, new remote origins, extension publication or deployment change is proposed.

## Acceptance and evidence gate

| #176 requirement | Evidence required before closure | Current state |
|---|---|---|
| Loaded TTF download as WOFF and WOFF2 | Browser-worker conversion and independent parse/browser-load round trip; metrics/coverage and checksums compared | Not implemented |
| Subset download from scripts/ranges | Verify requested coverage, shaping closure, unsupported input rejection and unchanged source; RFN-renamed result reparses with correct family | Not implemented |
| Before/after sizes | UI reports actual source/output byte lengths; cancel/failure does not leave stale size/download state | Not implemented |
| WASM absent from initial JS | Build chunk inspection, cold-browser network assertion before action, performance budget after build | No new kit WASM introduced by this design |
| ZIP, CSS, font-display, unicode-range, optional base64 | Download assertions for files, safe paths, correct final names/ranges, archive/base64 limits and license metadata | Original self-host archive exists; new kit absent |
| License handling first or together | Every residual #188 item above tested at worker, manifest and UI layers | Analysis API present; enforcement/packaging/rename absent |
| Strict CSP and attribution | Existing route policy enforced, zero violations, same-origin lazy WASM; any policy delta justified and security-reviewed; all new libraries credited | No CSP/dependency changes in this document |
| Conversion round-trip e2e | Real Chromium worker test plus app download round trip, including hostile/oversized/cancel inputs | Not implemented |

Required commands for the implementation: `pnpm verify`, `pnpm test:e2e` (browser, real-worker and UI suites), and `pnpm cli:build` if public parser/license/export APIs change. Use existing OFL fixtures with their included license files and synthetic license metadata fixtures; do not add proprietary fonts. If a browser-specific format is unsupported, record the tested support matrix rather than claiming universal support.

## Decision requested from the owner

Approve either (a) a separate medium-priority #188 integration prerequisite followed by #176, or (b) the enumerated residual #188 work explicitly within a combined implementation scope. No implementation of that residual scope is authorized by this design. Codec selection and any new dependencies remain subject to the checks above. Until then, keep #176 and #188 open and ship neither conversion nor subsetting.
