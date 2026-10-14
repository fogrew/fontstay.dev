export const HELP: Record<string, string> = {
  'size-adjust':
    'Scales the fallback font so its letters have the same average width as the web font. Above 100% the fallback is enlarged, below 100% it is shrunk. This is what stops lines from wrapping differently when the web font arrives.',
  'ascent-override':
    'Sets how far text rises above the baseline in the fallback font, as a percentage of the font size, so line boxes have the same height as with the web font.',
  'descent-override':
    'Sets how far text drops below the baseline in the fallback font, as a percentage of the font size.',
  'line-gap-override':
    'Sets the extra space the font adds between lines. Usually 0% so the line-height rule decides the spacing.',
  audience:
    'The browsers your visitors use, written as a Browserslist query such as "defaults" or "baseline widely available". The tool maps browsers to operating systems and uses the shares to decide which fallback fonts matter most.',
  fallback:
    'A system font that is shown instead of the web font while it loads. The tool picks one per operating system and tunes it to the web font with size-adjust and the vertical overrides.',
  'font-kind':
    'sans-serif, serif or monospace. It decides which system fonts are candidates and what generic family ends the stack.',
  'layout-shift':
    'How much the page moves when the web font replaces the fallback, measured like the CLS metric. Below 0.1 is good, above 0.25 is poor. The tool shows it with and without the adjusted fallback.',
  'unicode-range':
    'Limits the fallback faces to the characters the web font covers, so other characters use the generic family as they would without the web font.',
  'per-script':
    'When letters of another script (for example Cyrillic) are proportionally wider or narrower than Latin ones, the fallback gets its own face with its own size-adjust for that script.',
  'export-formats':
    'CSS, CSS variables, Tailwind theme, Next.js, Nuxt and Astro font configs, preload tags and a Font Loading API script.',
};
