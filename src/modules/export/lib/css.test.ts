import { describe, expect, it } from 'vitest';
import { type FallbackFace, generateFallbackCss } from '../index';

const face: FallbackFace = {
  family: 'Inter Fallback: Arial',
  localNames: ['Arial', 'ArialMT', 'Arial'],
  adjustment: {
    sizeAdjust: 1.071194,
    ascentOverride: 0.904365,
    descentOverride: 0.22518,
    lineGapOverride: 0,
  },
};

describe('fallback CSS export', () => {
  it('emits rounded descriptors, ordered local variants and a final family declaration', () => {
    expect(
      generateFallbackCss({
        targetFamily: 'Inter',
        fallbacks: [face],
        genericFamily: 'sans-serif',
      }),
    ).toMatchInlineSnapshot(`
      {
        "fontFaces": "@font-face {
        font-family: "Inter Fallback: Arial";
        src: local("Arial"), local("ArialMT");
        size-adjust: 107.1194%;
        ascent-override: 90.4365%;
        descent-override: 22.518%;
        line-gap-override: 0%;
      }",
        "fontFamily": "font-family: "Inter", "Inter Fallback: Arial", sans-serif;",
      }
    `);
  });

  it('preserves fallback order and separates multiple rules', () => {
    const output = generateFallbackCss({
      targetFamily: 'Inter',
      fallbacks: [
        face,
        {
          ...face,
          family: 'Inter Fallback: Helvetica',
          localNames: ['Helvetica', 'HelveticaNeue'],
        },
      ],
      genericFamily: 'serif',
    });
    expect(output.fontFaces.match(/@font-face/g)).toHaveLength(2);
    expect(output.fontFaces).toContain('}\n\n@font-face');
    expect(output.fontFamily).toBe(
      'font-family: "Inter", "Inter Fallback: Arial", "Inter Fallback: Helvetica", serif;',
    );
  });

  it('escapes string syntax, controls and HTML style terminators', () => {
    const name = 'A"\\\n</style>';
    const output = generateFallbackCss({
      targetFamily: name,
      fallbacks: [{ ...face, localNames: [name] }],
      genericFamily: 'sans-serif',
    });
    expect(output.fontFaces).toContain('local("A\\"\\\\\\a \\3c /style>")');
    expect(output.fontFamily).not.toContain('</style>');
  });

  it('emits a validated unicode-range descriptor', () => {
    const output = generateFallbackCss({
      targetFamily: 'Inter',
      fallbacks: [{ ...face, unicodeRange: 'U+20-7E, U+A0' }],
      genericFamily: 'sans-serif',
    });
    expect(output.fontFaces).toContain('  unicode-range: U+20-7E, U+A0;');
  });

  it.each(['U+20; color: red', 'u+20', 'U+110000x', ''])(
    'rejects the unicode-range %j',
    (unicodeRange) => {
      expect(() =>
        generateFallbackCss({
          targetFamily: 'Inter',
          fallbacks: [{ ...face, unicodeRange }],
          genericFamily: 'sans-serif',
        }),
      ).toThrow();
    },
  );
  it('supports a target-only family stack', () => {
    expect(
      generateFallbackCss({ targetFamily: 'serif', fallbacks: [], genericFamily: 'serif' }),
    ).toEqual({ fontFaces: '', fontFamily: 'font-family: "serif", serif;' });
  });

  it.each([NaN, Infinity, -1, 0])('rejects invalid size adjustment %s', (sizeAdjust) => {
    expect(() =>
      generateFallbackCss({
        targetFamily: 'Inter',
        fallbacks: [{ ...face, adjustment: { ...face.adjustment, sizeAdjust } }],
        genericFamily: 'sans-serif',
      }),
    ).toThrow('invalid-adjustment');
  });

  it('rejects values that disappear at export precision', () => {
    expect(() =>
      generateFallbackCss({
        targetFamily: 'Inter',
        fallbacks: [{ ...face, adjustment: { ...face.adjustment, sizeAdjust: 1e-12 } }],
        genericFamily: 'sans-serif',
      }),
    ).toThrow('invalid-adjustment');
  });

  it('rejects empty/invalid names, colliding aliases and unsafe generic values', () => {
    const input = {
      targetFamily: 'Inter',
      fallbacks: [face],
      genericFamily: 'sans-serif',
    } as const;
    for (const name of ['', ' ', 'A\0B', '\ud800']) {
      expect(() => generateFallbackCss({ ...input, targetFamily: name })).toThrow('invalid-name');
    }
    expect(() =>
      generateFallbackCss({ ...input, fallbacks: [{ ...face, family: 'inter' }] }),
    ).toThrow('duplicate-family');
    expect(() => generateFallbackCss({ ...input, fallbacks: [face, face] })).toThrow(
      'duplicate-family',
    );
    expect(() =>
      generateFallbackCss({ ...input, fallbacks: [{ ...face, localNames: [] }] }),
    ).toThrow('invalid-name');
    expect(() =>
      generateFallbackCss({ ...input, genericFamily: 'serif; color:red' as 'serif' }),
    ).toThrow('invalid-generic');
  });
});
