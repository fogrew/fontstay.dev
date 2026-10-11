import { describe, expect, it } from 'vitest';
import { classifyFont, isMonospaced } from './classify';

describe('classifyFont', () => {
  it('reads the PANOSE serif style', () => {
    expect(classifyFont({ panose: [2, 11, 5], familyClass: 0, monospaced: false })).toBe(
      'sans-serif',
    );
    expect(classifyFont({ panose: [2, 2, 5], familyClass: 0, monospaced: false })).toBe('serif');
  });

  it('falls back to the IBM family class', () => {
    expect(classifyFont({ panose: [0, 0], familyClass: 0x0200, monospaced: false })).toBe('serif');
    expect(classifyFont({ panose: [2, 0], familyClass: 0x0801, monospaced: false })).toBe(
      'sans-serif',
    );
    expect(classifyFont({ panose: undefined, familyClass: 0x0a00, monospaced: false })).toBeNull();
  });

  it('prefers monospace over the tables', () => {
    expect(classifyFont({ panose: [2, 11], familyClass: 0x0800, monospaced: true })).toBe(
      'monospace',
    );
  });
});

describe('isMonospaced', () => {
  const letters = Array.from({ length: 62 }, (_, index) => 0x30 + index);

  it('needs equal advances for every letter and digit', () => {
    expect(
      isMonospaced(
        letters,
        letters.map(() => 600),
      ),
    ).toBe(true);
    expect(
      isMonospaced(
        letters,
        letters.map((_, index) => 500 + index),
      ),
    ).toBe(false);
  });

  it('does not guess from a tiny font', () => {
    expect(isMonospaced([0x41, 0x42], [500, 500])).toBe(false);
  });
});
