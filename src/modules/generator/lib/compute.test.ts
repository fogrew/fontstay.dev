import { describe, expect, it } from 'vitest';
import { displayName, isNoCoverage, sampleText } from './compute';
import { adjustmentOf, buildCss } from './css';
import { font } from './font.test-util';
import { rankFor } from './per-os';

const ascii = Array.from({ length: 95 }, (_, index) => 0x20 + index);

describe('buildCss', () => {
  it('applies manual overrides and names a single face "Fallback"', () => {
    const { candidates } = rankFor(font(ascii, 520), 'windows', 'en');
    const [best] = candidates;
    if (!best) throw new Error('no candidates');
    const adjustment = adjustmentOf(best.adjustment, { sizeAdjust: 1.05 });
    expect(adjustment.sizeAdjust).toBe(1.05);
    expect(adjustment.ascentOverride).toBe(best.adjustment.ascentOverride);
    const css = buildCss(
      'Test',
      [{ family: best.family, localNames: best.localNames, adjustment }],
      best.category,
    );
    expect(css.fontFaces).toContain('size-adjust: 105%');
    expect(css.fontFamily).toContain('"Test Fallback"');
  });

  it('names several faces after their fonts', () => {
    const adjustment = {
      sizeAdjust: 1,
      ascentOverride: 1,
      descentOverride: 0.2,
      lineGapOverride: 0,
    };
    const css = buildCss(
      'Test',
      [
        { family: 'Arial', localNames: ['Arial'], adjustment },
        { family: 'Roboto', localNames: ['Roboto'], adjustment },
      ],
      'sans-serif',
    );
    expect(css.fontFamily).toContain('"Test Fallback Arial"');
    expect(css.fontFamily).toContain('"Test Fallback Roboto"');
  });
});

describe('isNoCoverage', () => {
  it('flags a font without any glyph in the language', () => {
    expect.assertions(1);
    try {
      rankFor(font([0x16a0, 0x16a1], 600), 'windows', 'en');
    } catch (error) {
      expect(isNoCoverage(error)).toBe(true);
    }
  });
});

describe('sampleText', () => {
  it('keeps the preferred text when the font covers it', () => {
    expect(sampleText(font(ascii, 500), 'The quick brown fox')).toBe('The quick brown fox');
  });

  it('builds a sample from the font own glyphs when the preferred text is mostly missing', () => {
    const runes = Array.from({ length: 20 }, (_, index) => 0x16a0 + index);
    const sample = sampleText(font([0x20, ...runes], 500), 'The quick brown fox');
    expect(sample).not.toContain('quick');
    expect(
      [...sample.replaceAll(' ', '')].every((char) => runes.includes(char.codePointAt(0) ?? 0)),
    ).toBe(true);
    expect(sample.split(' ').length).toBeGreaterThan(1);
  });
});

describe('displayName', () => {
  it('removes bidirectional control characters from file names', () => {
    expect(displayName('\u202Etxt.woff2')).toBe('txt.woff2');
    expect(displayName('a\u2066b\u2069.ttf')).toBe('ab.ttf');
    expect(displayName('plain.otf')).toBe('plain.otf');
  });
});
