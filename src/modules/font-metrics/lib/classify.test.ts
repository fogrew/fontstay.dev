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
    expect(classifyFont({ panose: undefined, familyClass: 0x0900, monospaced: false })).toBeNull();
  });

  it.each([
    [10, 'serif'],
    [11, 'sans-serif'],
    [14, 'sans-serif'],
    [15, 'sans-serif'],
  ] as const)('maps the PANOSE serif style %i to %s', (style, expected) => {
    expect(classifyFont({ panose: [2, style], familyClass: 0, monospaced: false })).toBe(expected);
  });

  it('ignores an unspecified style and a negative family class', () => {
    expect(classifyFont({ panose: [2, 1], familyClass: -0x0100, monospaced: false })).toBeNull();
  });

  it('reads the category from the font name before the tables', () => {
    const base = { panose: [2, 11], familyClass: 0x0800, monospaced: false };
    expect(
      classifyFont({ ...base, names: ['Averia Serif Libre', null, 'AveriaSerifLibre-Italic'] }),
    ).toBe('serif');
    expect(classifyFont({ ...base, names: ['Noto Sans', null, null] })).toBe('sans-serif');
    expect(classifyFont({ ...base, names: ['Noto Sans Mono', null, null] })).toBe('monospace');
    expect(classifyFont({ ...base, names: ['Fira Code', null, null] })).toBe('monospace');
    expect(classifyFont({ ...base, names: ['Inter', null, null] })).toBe('sans-serif');
  });

  describe('cursive', () => {
    it('reads the PANOSE Latin hand written family type', () => {
      expect(classifyFont({ panose: [3, 15], familyClass: 0, monospaced: false })).toBe('cursive');
    });

    it('reads the IBM scripts family class', () => {
      expect(classifyFont({ panose: undefined, familyClass: 0x0a01, monospaced: false })).toBe(
        'cursive',
      );
    });

    it('prefers the tables over a sans or serif word in the name', () => {
      expect(
        classifyFont({
          panose: [3, 15],
          familyClass: 0x0a00,
          monospaced: false,
          names: ['Comic Sans MS', null, null],
        }),
      ).toBe('cursive');
    });

    it.each(['Brush Script MT', 'Permanent Marker', 'Patrick Hand', 'MyHandwriting'])(
      'uses the name %s as a weak hint when the tables say nothing',
      (name) => {
        expect(
          classifyFont({ panose: [0, 0], familyClass: 0, monospaced: false, names: [name] }),
        ).toBe('cursive');
      },
    );

    it('lets the tables win over the weak name hint', () => {
      expect(
        classifyFont({
          panose: [2, 11],
          familyClass: 0,
          monospaced: false,
          names: ['Script Sans Text'],
        }),
      ).toBe('sans-serif');
      expect(
        classifyFont({
          panose: [2, 2],
          familyClass: 0,
          monospaced: false,
          names: ['Handel Gothic'],
        }),
      ).toBe('sans-serif');
    });

    it('does not match partial words', () => {
      expect(
        classifyFont({ panose: [0, 0], familyClass: 0, monospaced: false, names: ['Handjet'] }),
      ).toBeNull();
    });
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
