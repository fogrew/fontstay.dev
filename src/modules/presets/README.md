# presets

Curated font stacks per typographic category. `presetPicks` maps a stack to preinstalled
fonts of the OS fonts dataset per system, so each preset can be opened in the generator
through a share link (`#s=...`) that carries the font type and the per-system picks.
The category names follow the ones popularised by modern-font-stacks (see CREDITS.md);
the stacks themselves are our own selection.

## System font groups as fallback choices

Spike for #413. Question: should `system-ui`, `ui-sans-serif`, `-apple-system` and the like be selectable fallbacks in Fine-tuning?

Method: 15 sans-serif fonts of the OS fonts dataset stood in for web fonts (the repository holds no web-font metrics beyond the test fixtures). For each, the unadjusted group resolved to the worst case over Windows (Segoe UI), Android (Roboto) and Linux (Ubuntu, DejaVu Sans, Noto Sans), without `size-adjust` or vertical overrides: width error is `|1 - sizeAdjust|` from the English-weighted fit, line-height error is the difference of the hhea line heights after scaling. The fitted pick is the best of the other 14 fonts after `size-adjust`, measured as the mean relative error of the width of 22 sample words. macOS `system-ui` (San Francisco) has no metrics in the dataset and is not included.

| | Mean error |
|---|---|
| System group, width | 13.8% (7-19%) |
| System group, line height | 20.3% (14-31%) |
| Best fitted pick, word width | 1.0% (0-2%) |

A group cannot carry per-font overrides and resolves to a different font per system, so the shift it causes is an order of magnitude above a fitted pick.

Decision: keep the groups in Presets only. They are for users who want no web font fallback logic at all, not a fallback for a specific web font; the Presets intro already says that the stack can be copied or opened in the generator, which preselects fitted fallbacks per system. No UI change and no follow-up issue.
