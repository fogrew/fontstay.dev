# import-receiver

Receives and validates data sent by the bookmarklet or the extension of `site-import`. It is a
separate module so the import page (`/<locale>/import/`, the only page without
`Cross-Origin-Opener-Policy`) loads nothing but this code.

- `lib/receiver.ts`: handshake. Announces itself to `window.opener`, accepts one message from the
  opener (or from its own window for the extension relay) with the right token. The opener
  branch and the announcement are off when the URL carries `&via=ext` (`acceptOpener`), so a
  page opened by the extension accepts its own window alone.
- `lib/payload.ts`: `sanitizeImport` rebuilds the payload field by field with limits.
- `lib/handoff.ts`: hands the sanitized data to the generator through IndexedDB.
- `lib/receive-page.ts`: the script of the import page.

See `docs/security.md`, section Site import.
