import { describe, expect, it } from 'vitest';
import { clampFontLimit, DEFAULT_FONT_LIMIT, MAX_FONT_LIMIT, MIN_FONT_LIMIT } from './font-limit';

describe('clampFontLimit', () => {
  it('keeps the Montserrat 200-600 x Cyrillic + Latin case (12 faces) under the default', () => {
    expect(DEFAULT_FONT_LIMIT).toBeGreaterThanOrEqual(6 * 2);
  });

  it('rounds and clamps to the allowed range', () => {
    expect(clampFontLimit(10.4)).toBe(10);
    expect(clampFontLimit(0)).toBe(MIN_FONT_LIMIT);
    expect(clampFontLimit(10_000)).toBe(MAX_FONT_LIMIT);
    expect(clampFontLimit(Number.NaN)).toBe(DEFAULT_FONT_LIMIT);
  });
});
