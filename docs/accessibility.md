# Accessibility audit (WCAG 2.2 AA)

Audit of 2026-10-12 against the `develop` branch. Scope: all pages in English and Russian (generator, system font catalog and font pages, presets, guide, credits).

## Automated checks (run on every `pnpm test:e2e`)

| Check | Where |
|---|---|
| axe-core, tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, on every page, both locales, light and dark colour scheme | `tests/e2e/a11y.spec.ts` |
| axe on the generator with a font loaded and every collapsible section open (spacing, CSS import, Google Fonts, share, coverage, export) | `tests/e2e/a11y.spec.ts` |
| Reflow at 320 px (WCAG 1.4.10): no horizontal page scroll on any page and in the generator with a font | `tests/e2e/a11y.spec.ts` |
| Keyboard path: skip link, section toggles with Enter and Space | `tests/e2e/a11y.spec.ts` |
| Forced colours: support states remain distinguishable by text | `tests/e2e/a11y.spec.ts` |
| Reduced motion: no transitions on the preview | `tests/e2e/generator.spec.ts` |
| CSP violations fail every test | `tests/e2e/fixtures.ts` |

## What the interface does

- **Keyboard**: every control is a native element or has a documented keyboard model: accordion headings are buttons with `aria-expanded`; the panel splitters are focusable separators moved with the arrow keys; the Unicode map is a focusable group moved with the arrow keys and described in a status line, with a table as the accessible alternative; the catalog table headers are sort buttons with `aria-sort`.
- **Not colour only**: support states carry a symbol and a visually hidden text; layout shift ratings carry a symbol and a hidden rating word; missing glyphs are underlined as well as highlighted.
- **Live regions** announce font loading, fitting, copy results, downloads and the share link; results counts are in a polite status region.
- **Names and language**: every field has a label, every locale sets `lang`; sections use headings in order; icon-only buttons have accessible names.
- **Targets (2.5.8)**: interactive targets are at least 24 × 24 px or spaced; splitters are 24 px tall.
- **Contrast (1.4.3, 1.4.11)**: colours are tokens with `light-dark()` pairs; dark scheme is covered by axe; rating pills use text colours chosen for at least 4.5:1.
- **Motion**: no animation except button transitions, which are disabled with `prefers-reduced-motion`.

## Findings fixed during the audit

- Splitters between result panels and closed accordion headers overlapped, making headers hard to click and failing the target size rule (24 px splitters now overlap only the panel above).
- Closed accordion headers were squeezed by the flex layout; they no longer shrink.
- Hidden labels in the support matrix were positioned outside their scroll container and caused page scroll.
- Footer and header links were smaller than 24 px or touched each other on content pages (the Russian text wraps); spacing added. On desktop the content pages overlapped the footer.
- The header navigation did not wrap at 320 px.
- Long URLs on the font pages overflowed at 320 px.

## Not covered by automation: manual screen reader pass

Automated tools cannot judge whether announcements are useful. A manual pass with NVDA (Windows, Firefox and Chrome) and VoiceOver (macOS and iOS Safari) is still needed for: the accordion and splitter pattern, the Unicode map readout, the live regions (fitting, copy, downloads, missing glyph summary), the editable preview text, and the Russian messages. It is ticketed in the issue linked from #40 because it needs a person with the assistive technologies; findings go back into this file.

## Known limitations

- The Unicode map is a pointer and arrow-key readout rather than a grid with one tab stop per cell; the per-block table carries the same data.
- The editable preview uses `contenteditable="plaintext-only"`, which Firefox supports from version 136; older versions fall back to a non-editable text.
- Zoom to 400% is verified only through the 320 px reflow test.
