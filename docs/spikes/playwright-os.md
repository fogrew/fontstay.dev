# Playwright across operating systems (#7)

## Scope and outcome

Issue #7 was renamed on 2026-10-31 from “Playwright in the Cloudflare Pages build container” to “Playwright on other operating systems for metrics and difference screenshots”. The owner's [scope clarification](https://github.com/fogrew/fontstay.dev/issues/7#issuecomment-6544545195) takes precedence over the old body: measure fonts and capture fallback differences on an OS other than the visitor's. The work was postponed until after 1.0.0. The earlier [CI comment](https://github.com/fogrew/fontstay.dev/issues/7#issuecomment-6543754897) records that e2e already runs in GitHub Actions.

**Local result:** changing the device preset/user agent does not provide another OS's fonts or rendering stack. On one macOS host, native Chromium, the Windows Desktop Chrome preset and the iPhone preset produced identical measurements and PNG hashes at fixed geometry. This is evidence against using device emulation for cross-OS font previews, not a completed Windows/Linux/iOS measurement matrix.

**Recommendation for owner decision:** keep the static browser app and existing e2e job. Collect opt-in, offline reference artifacts on real desktop OS runners first. A live cross-OS screenshot service would be a separate product/backend/security decision. No service, workflow, deployment or CSP changes are made by this spike.

## Reproduce locally

Use the repository's pinned Node/pnpm and installed dependencies:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
node scripts/spikes/playwright-os.mjs
```

The optional first argument selects the output directory (default `test-results/playwright-os`, ignored by git). The script loads the existing OFL Source Sans Pro fixture locally, probes exact local face names with `FontFace(..., 'local(...)').load()`, uses the loaded aliases for available faces (explicit monospace otherwise), measures a fixed Latin string with canvas and a 440 CSS px block, and saves JSON plus full-page PNGs. It uses Chromium for all three contexts, including the iPhone preset; that context is not Safari or iOS. It normalizes viewport (1024 × 768), DPR (1), locale, theme and motion. It makes no network requests and takes no user font input.

`available` means the exact local name loaded; a failure is not an exhaustive inventory of installed fonts. Rows whose face is unavailable measure the explicit monospace fallback and must not be treated as metrics of the missing font. The JSON records the actual host kernel/architecture, Node/browser versions, user agents, fixture hash, metrics and PNG hashes. Reported canvas ink bounds and DOM line boxes are browser observations, not extracted OpenType table metrics.

## Observed run (2026-11-07)

Host: Darwin 27.2.0 arm64; Node v24.21.0; Playwright 1.64.1; Chromium 156.0.8078.4. Warm probe time after the alias-resolution fix: 2.551 s (excludes dependency/browser download and any site build). Fixture SHA-256: `ca3b88d031a0b610e69103cc984b0e285b1cef0cf78f496ee5d193038022284f`.

| Observation | Native Chromium | Windows UA preset | iPhone UA preset |
|---|---|---|---|
| Arial / Helvetica Neue / Times New Roman local face | loaded | loaded | loaded |
| Segoe UI local face | unavailable | unavailable | unavailable |
| Source Sans Pro width / block height (CSS px) | 1010.7515 / 120 | 1010.7515 / 120 | 1010.7515 / 120 |
| Arial width / block height (CSS px) | 1088.625 / 111 | 1088.625 / 111 | 1088.625 / 111 |
| Helvetica Neue width / block height (CSS px) | 1099.8397 / 114 | 1099.8397 / 114 | 1099.8397 / 114 |
| PNG SHA-256 | same | same | same |

All three PNG hashes: `4749155ff0fbea783e64b02bda2be2b91fb2bbd3ad43f0756543aace19579a10`. Matching hashes apply only to this controlled run. The screenshots display the web font and each fallback for visual comparison; they do not assert target-OS fidelity. Playwright's [emulation documentation](https://playwright.dev/docs/emulation) describes user agent, screen, viewport and touch simulation. Its [visual comparison guide](https://playwright.dev/docs/test-snapshots) warns that rendering depends on the host OS, hardware and browser environment.

## Remaining experiment and decision gates

1. Run the same probe at the same commit and Playwright version on real Windows, macOS and Linux hosts. Record OS release and installed font versions/hashes separately; do not redistribute proprietary font files. Choose a legally usable common web-font fixture and explicitly installed target fallback faces. Compare JSON and web/fallback PNG pairs, recording install time and total capture time per host.
2. Add repeat runs on each host to establish the noise floor before using image differences as a regression gate. Capture the app's actual preview at identical viewport, DPR, language, text, font size, weight and descriptor settings; the current probe is only the host-versus-emulation control.
3. Treat Android/iOS separately: a desktop device preset does not prove mobile rendering. Obtain actual-device results or document their absence. Playwright WebKit on desktop is not a measurement of iOS system fonts.
4. For an offline dataset, commit metrics/provenance only and retain screenshots as bounded review artifacts. Existing parsed system metrics (`scripts/os-fonts/extract-metrics.mjs`) answer font-table/shaping questions; only target-host captures can establish native rasterization/layout differences.
5. Before a live service, decide ownership, privacy of uploaded fonts/text, font licensing, retention, resource limits and costs. The current static site cannot launch Windows/macOS browsers on the visitor's behalf. No paid service is selected.

These target hosts and a deployment environment were not provisioned for this investigation. #7 remains open until the owner accepts the scope and the outstanding target-host evidence or chooses a narrower documented conclusion.

## Separate Cloudflare question

The historical Cloudflare browser-install spike was never run; no Cloudflare install time, working-browser list, missing-library trace or total build time is claimed here. The checked-in `.github/workflows/ci.yml` has a separate Ubuntu `e2e` job that installs Chromium with OS dependencies and runs `pnpm test:e2e`; `pnpm verify` excludes browser suites. Cloudflare continues serving the static build.

The [current Workers build image documentation](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/) is the source for a future image-specific investigation; the old Ubuntu 22.04/gVisor assumptions are not measured facts of this run. A Linux build container cannot supply native Windows/macOS rendering even if Chromium launches successfully. If the owner still wants browser execution inside Workers Builds, track it separately and measure a real build without replacing the working e2e gate first.
