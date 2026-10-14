# fontstay import extension

Sends the fonts, text and sizes of the current page to the generator. It does the same job as
the bookmarklet from the "Import from a website" panel, and it also works on sites whose
Content Security Policy blocks bookmarklets.

- `manifest.json`: Manifest V3. Permissions: `activeTab` and `scripting` only. The extension
  cannot read any page until you click its toolbar button, and its only standing host access is
  the import pages of fontstay.dev (`https://fontstay.dev/*/import/*`).
- `background.js`: on a click it injects `collect-run.js` into the active tab, opens
  `https://fontstay.dev/<locale>/import/#t=<token>` and hands the result to the content script.
- `relay.js`: content script of the import page. It posts the data to the page with the token.
- `collect-run.js`: generated from `src/modules/site-import/collector/collect.js` by
  `pnpm extension:build` (a unit test fails when it is out of date).

The import page checks the token, sanitizes the data and stores it for the generator, which
asks you to confirm before it uses anything. See `docs/security.md`.

## Install for development

1. Open `chrome://extensions` (or `edge://extensions`), enable Developer mode.
2. Choose "Load unpacked" and select this folder.
3. To try it against another origin (for example `http://localhost:4321`), change `ORIGIN` in
   `background.js` and the `matches` pattern in `manifest.json`.

Firefox and the stores are not covered yet.
