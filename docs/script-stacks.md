# Script-aware stacks

When the web font has no glyphs for a script but does contain the space, the browser takes spaces from the web font and letters from a system font, so every word is shaped in pieces (Arabic text: 17.9 ms with the web font first against 7.2 ms with a system Arabic font first, [measured by Ivan Kristianto](https://www.ivankristianto.com/split-webfont-text-layout/)).

## What is emitted

For each script the web font cannot draw and the user ticks in the Tuning panel (opt-in, off by default), one rule is appended to the CSS, variables and Tailwind exports and to the WordPress `theme.json` (`styles.css`):

```css
:lang(ar),
:lang(fa),
:lang(ur) {
  font-family: "Segoe UI", "Tahoma", "Geeza Pro", "Noto Sans Arabic", sans-serif;
}
```

- The font list is the union of the system fonts that carry the script on the systems currently enabled in the audience, in system order, followed by the page's generic family. The web font is left out on purpose, so spaces and letters come from the same font.
- Scripts: Arabic, Hebrew, Devanagari, Bengali, Tamil, Thai, Japanese (kana), Korean (Hangul), Chinese simplified and Chinese traditional (selected by `zh-Hans`/`zh-CN`/`zh-SG` and `zh-Hant`/`zh-TW`/`zh-HK`/`zh-MO`; bare `zh` is left to the browser). A script is offered when the font has fewer than 20 letters of it.
- Candidates per system are curated in `src/modules/generator/lib/script-stacks.ts`; each is checked against the per-font coverage dataset (below) and dropped when its font file does not cover the script's main block (80 % of its letters; 90 % for kana and Hangul; 50 % of the Unified Ideographs block for Chinese). A font without a dataset entry stays in the stack unverified.
- `:lang()` matches through the inherited `lang` attribute, so the rule applies to every element of a page declared in that language and overrides `font-family` there (including headings with a different family). Latin words inside those elements use the system font too.

- Next, Nuxt, Astro and Fontaine configs cannot express a selector: their header comment points to the CSS export when a rule exists.
- The ticked scripts are kept in the share link (with the Tuning part) and in the saved settings. A script the font covers is ignored.
- CLI: `--stack-scripts arabic,thai`; library: `stackScripts`; MCP `fit_font` and `get_export`: `stack_scripts`. A script is skipped when any given font covers it.

## Emoji and symbols

Emoji and symbols have no language selector, so `:lang()` cannot target them. The Tuning panel offers an opt-in "Emoji and symbols" option when the web font has fewer than 20 emoji. It appends the system emoji fonts of the enabled systems (Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji) to the font stack of every output, before the generic family, in every export format. An emoji font in the stack was chosen over a `unicode-range` face: it needs no extra `@font-face`, works in all formats and keeps the web font and its adjusted fallbacks first. If the web font itself contains the zero width joiner or variation selectors, the browser still takes those from it.

The option is kept in the share link (with the Tuning part) and in the saved settings. CLI: `--emoji`; library: `emoji`; MCP `fit_font` and `get_export`: `emoji`. It applies to each font with fewer than 20 emoji.

## Effect on CLS

The rule removes the web font from the stack for that script, so no swap happens for such text: the system font is final, and the web font load cannot shift it. Latin text on the same page keeps the adjusted fallback.

## Coverage dataset

`src/modules/os-fonts/data/script-coverage.json` holds, per font, how many letters of each script's main block the font draws (with the per-script `totals` stored once), with the source file, its SHA-256 and, for downloads, the URL and license. It is regenerated with `pnpm os-fonts:scripts [extra font dirs...]` (reads the `cmap` of the font files; Windows fonts come from `%WINDIR%Fonts`, Noto fonts from a pinned google/fonts commit; entries for fonts it cannot find are kept).

- Verified: Segoe UI, Tahoma, Arial, Nirmala UI, Leelawadee UI, Yu Gothic, MS Gothic, Malgun Gothic, Microsoft YaHei, SimSun, Microsoft JhengHei (Windows 11 files) and Noto Sans / Naskh for each script (Noto Sans CJK names alias the Noto Sans JP/KR/SC/TC files).
- Not verified: the macOS and iOS fonts (Geeza Pro, Arial Hebrew, the Sangam MN family, Thonburi, Hiragino Sans, Apple SD Gothic Neo, PingFang) have no dataset entry because the files are not available off macOS; run `pnpm os-fonts:scripts` on a Mac to fill them in, after adding them to `scripts/os-fonts/script-sources.ts`.
- Chinese simplified and traditional share one Unicode block, so the dataset cannot tell a Simplified-only font from a Traditional-only one; the two stacks differ by their curated candidates. Follow-up: #563.
- Which system ships a font is still curated, as before.

## Not covered yet

macOS and iOS coverage data, and a layout-time benchmark. These are tracked as follow-up issues.
