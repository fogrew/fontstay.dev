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
| `Cross-Origin-Opener-Policy` | `same-origin`, detached on `/:locale/import/` | The import page must keep `window.opener` to answer the site that opened it (see Site import). |
| `Cross-Origin-Resource-Policy` | `same-origin` | |
| `Cache-Control` on `/_astro/*` | `public, max-age=31536000, immutable` | Build output is content-hashed. |

`script-src` and `style-src` exist only in the meta policy, and a meta policy applies only to content parsed after it. Astro places it early in `<head>`, and the app has no HTML injection sink, so the rule against `dangerouslySetInnerHTML` and similar sinks is load-bearing. Possible later hardening: `require-trusted-types-for 'script'`.

## Site import

The bookmarklet and the browser extension (`extension/`) send the fonts, text and sizes of any website to the generator, so the data is untrusted and the sending page is hostile by assumption.

- **Isolated receiver.** Only `/<locale>/import/` (the `import-receiver` module, no UI) drops `Cross-Origin-Opener-Policy` so that the opener survives. They run no app code: a few lines read a token from the URL fragment, wait for one message, sanitize it, store it in IndexedDB and redirect to the generator (which has the strict policy).
- **Handshake.** The page announces itself to `window.opener` (`fontstay:ready`, no secrets). The sender replies once with `fontstay:import`, the random token from the URL (96+ bits) and the payload, addressed to the exact origin of the generator. The receiver accepts a message only from `window.opener` (or from its own window for the extension relay) and only with the matching token, once, within 60 seconds. The origin shown to the user is `event.origin`, never the payload's claim; the extension channel is the only one that supplies its own claim, because its content script runs in the page itself.
- **Sanitizing** (`src/modules/site-import/lib/payload.ts`). The payload is rebuilt field by field, never copied: unknown keys and prototype tricks are dropped, numbers are range checked, text loses control, bidi and format characters and is capped by code points, file names become a safe base name, URLs must be `https` without credentials, counts and sizes are bounded (8 files, 10 MB each, 30 MB in total, 64 faces). Font bytes are not trusted either: they go through the normal font parser worker after the user confirms.
- **Confirmation.** Nothing is used until the user accepts the summary ("Import from <origin>?") in the generator; data older than 10 minutes is ignored.
- **Clipboard fallback.** The pasted JSON carries metadata only (no files) and its origin is shown as unverified. It does include the page title and a text sample, which the alert tells the user, because clipboard managers can read it.
- **Links.** A font that could not be fetched is listed with a download link that shows the host the sender chose; links open with `noopener noreferrer`.
- **Limits.** A page with a strict CSP can block a bookmarklet (Firefox does) or the font downloads (`connect-src`); the extension and the clipboard path cover that. A hostile page can still open the import page and push data, which is why the confirmation exists.

## Rules for code

- No inline `<style>` elements or `style` attributes in HTML at build time; dynamic CSS goes through `CSSStyleSheet` and `document.adoptedStyleSheets` (see `Preview.tsx`), and per-element styles through the CSSOM.
- No `eval`, no inline event handlers, no `dangerouslySetInnerHTML`.
- New origins, `blob:` or `data:` sources, or any `'unsafe-*'` keyword must be justified in the PR and listed in the table above.
- Same-origin iframes (CLS simulator) are allowed by `frame-ancestors 'self'`; framing by other origins is not.
- Features that load external resources add their origin to the matching directive in the PR that introduces them (the Google Fonts picker adds `https://fonts.googleapis.com` and `https://fonts.gstatic.com`, the Fontsource picker `https://cdn.jsdelivr.net`, to `connect-src`).
- The service worker (`/sw.js`, generated after the build by `scripts/pwa/build-pwa.mjs`) is same-origin, covered by `worker-src 'self'`, and served with `Cache-Control: no-cache`; it precaches only same-origin files and never handles cross-origin requests.

## Testing

`tests/e2e/serve.mjs` serves `dist/` with `public/_headers` applied the way Cloudflare does, and every e2e test fails if the page reports a CSP violation (`securitypolicyviolation`). `tests/e2e/security-headers.spec.ts` checks the headers and the policy's shape.
