# Security headers and CSP

The app reads font files that users choose and builds CSS and previews from them, so the page runs under a strict Content Security Policy and a baseline set of response headers.

## How it is delivered

- **`public/_headers`** is served by Cloudflare Workers static assets (production and previews) and carries the headers that cannot live in a `<meta>` tag.
- **Astro CSP** (`security.csp` in `astro.config.mjs`) emits a `<meta http-equiv="content-security-policy">` per page with SHA-256 hashes for every inline script and style it generates, plus our extra directives. A browser enforces the header policy and the meta policy together, so the header deliberately omits `script-src` and `style-src`.

## Policy

| Directive or header | Value | Why |
|---|---|---|
| `default-src` | `'self'` | Nothing is loaded from other origins. |
| `script-src`, `style-src` | `'self'` plus Astro's hashes | No `'unsafe-inline'` and no `'unsafe-eval'`. |
| `worker-src` | `'self'` | The font parser worker is a same-origin bundled module; no blob workers. |
| `frame-src` | `'self'` | Same-origin frames only (planned CLS simulator). |
| `font-src` | `'self' blob: data:` | Uploaded fonts are loaded from bytes in memory. |
| `connect-src` | `'self' https://fonts.googleapis.com https://fonts.gstatic.com https://cdn.jsdelivr.net` | Only the font pickers (jsDelivr hosts arbitrary npm and GitHub packages and CSP cannot restrict a path, so the code checks the host and the `/fontsource/fonts/` path and pins the package version from the bundled catalog): Google Fonts (stylesheet and font file downloads) and Fontsource (font files from jsDelivr); fonts are then loaded from memory. |
| `img-src` | `'self' data: blob:` | |
| `object-src`, `base-uri` | `'none'` | |
| `form-action` | `'self'` | |
| `frame-ancestors` | `'self'` (header only) | Not valid in a meta tag. Other sites cannot frame the app; same-origin frames (the planned CLS simulator) still work. |
| `X-Content-Type-Options` | `nosniff` | |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Only features supported by all major browsers, to avoid console noise. |
| `Cross-Origin-Opener-Policy` | `same-origin` | |
| `Cross-Origin-Resource-Policy` | `same-origin` | |
| `Cache-Control` on `/_astro/*` | `public, max-age=31536000, immutable` | Build output is content-hashed. |

`script-src` and `style-src` exist only in the meta policy, and a meta policy applies only to content parsed after it. Astro places it early in `<head>`, and the app has no HTML injection sink, so the rule against `dangerouslySetInnerHTML` and similar sinks is load-bearing. Possible later hardening: `require-trusted-types-for 'script'`.

## Rules for code

- No inline `<style>` elements or `style` attributes in HTML at build time; dynamic CSS goes through `CSSStyleSheet` and `document.adoptedStyleSheets` (see `Preview.tsx`), and per-element styles through the CSSOM.
- No `eval`, no inline event handlers, no `dangerouslySetInnerHTML`.
- New origins, `blob:` or `data:` sources, or any `'unsafe-*'` keyword must be justified in the PR and listed in the table above.
- Same-origin iframes (CLS simulator) are allowed by `frame-ancestors 'self'`; framing by other origins is not.
- Features that load external resources add their origin to the matching directive in the PR that introduces them (the Google Fonts picker adds `https://fonts.googleapis.com` and `https://fonts.gstatic.com`, the Fontsource picker `https://cdn.jsdelivr.net`, to `connect-src`).
- The service worker (`/sw.js`, generated after the build by `scripts/pwa/build-pwa.mjs`) is same-origin, covered by `worker-src 'self'`, and served with `Cache-Control: no-cache`; it precaches only same-origin files and never handles cross-origin requests.

## Testing

`tests/e2e/serve.mjs` serves `dist/` with `public/_headers` applied the way Cloudflare does, and every e2e test fails if the page reports a CSP violation (`securitypolicyviolation`). `tests/e2e/security-headers.spec.ts` checks the headers and the policy's shape.
