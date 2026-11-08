# Script-aware stacks

When the web font has no glyphs for a script but does contain the space, the browser takes spaces from the web font and letters from a system font, so every word is shaped in pieces (Arabic text: 17.9 ms with the web font first against 7.2 ms with a system Arabic font first, [measured by Ivan Kristianto](https://www.ivankristianto.com/split-webfont-text-layout/)).

## What is emitted

For each script the web font cannot draw and the user ticks in the Tuning panel (opt-in, off by default), one rule is appended to the CSS and variables exports:

```css
:lang(ar),
:lang(fa),
:lang(ur) {
  font-family: "Segoe UI", "Tahoma", "Geeza Pro", "Noto Sans Arabic", sans-serif;
}
```

- The font list is the union of the system fonts that carry the script on the systems currently enabled in the audience, in system order, followed by the page's generic family. The web font is left out on purpose, so spaces and letters come from the same font.
- Scripts: Arabic, Hebrew, Devanagari, Thai. A script is offered when the font has fewer than 20 letters of it. The font-to-script table is curated in `src/modules/generator/lib/script-stacks.ts` (system font names only, no metrics).
- `:lang()` matches through the inherited `lang` attribute, so the rule applies to every element of a page declared in that language and overrides `font-family` there (including headings with a different family). Latin words inside those elements use the system font too.

## Effect on CLS

The rule removes the web font from the stack for that script, so no swap happens for such text: the system font is final, and the web font load cannot shift it. Latin text on the same page keeps the adjusted fallback.

## Not covered yet

Emoji and symbols (no language selector exists for them, they need a `unicode-range` face or an emoji font in the stack), the other export formats, the share link, the CLI and MCP, a per-font coverage dataset instead of the curated table, and a layout-time benchmark. These are tracked as follow-up issues.
