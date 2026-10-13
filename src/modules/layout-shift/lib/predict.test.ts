import { describe, expect, it } from 'vitest';
import type { Block } from './document';
import { widthMismatch } from './model';
import { layoutDocument, type PredictFont, predictViewport, textWidth, wrapLines } from './predict';

const chars = [...' abcdefghijklmnopqrstuvwxyz'].map((char) => char.codePointAt(0) ?? 0);

function font(advance: number, extra: Partial<PredictFont> = {}): PredictFont {
  return {
    unitsPerEm: 1000,
    codePoints: chars,
    advances: chars.map(() => advance),
    scale: 1,
    ascent: 0.8,
    descent: 0.2,
    lineGap: 0,
    letterEm: 0,
    wordEm: 0,
    ...extra,
  };
}

describe('wrapLines', () => {
  it('breaks greedily at spaces', () => {
    expect(wrapLines([30, 30, 30], 10, 110)).toBe(1);
    expect(wrapLines([30, 30, 30], 10, 109)).toBe(2);
    expect(wrapLines([60, 60], 10, 100)).toBe(2);
    expect(wrapLines([200], 10, 100)).toBe(1);
    expect(wrapLines([], 10, 100)).toBe(1);
  });
});

describe('layoutDocument', () => {
  const blocks: Block[] = [
    { tag: 'p', text: 'aaaa aaaa' },
    { tag: 'p', text: 'bb' },
  ];

  it('stacks blocks with the line height of the font and collapsing margins', () => {
    const layout = layoutDocument(font(500), blocks, 232);
    expect(layout.lines).toEqual([1, 1]);
    expect(layout.boxes[0]).toMatchObject({ x: 16, y: 16, height: 16 });
    expect(layout.boxes[1]?.y).toBe(16 + 16 + 12);
    expect(layout.height).toBe(16 + 16 + 12 + 16 + 12 + 16);
  });

  it('wraps by advance width: 9 characters of 8px need 72px', () => {
    const wide = layoutDocument(font(500), blocks, 16 * 2 + 70);
    expect(wide.lines[0]).toBe(2);
    const fits = layoutDocument(font(500), blocks, 16 * 2 + 72);
    expect(fits.lines[0]).toBe(1);
  });

  it('applies size-adjust to widths, letter and word spacing, and rounds the line height', () => {
    const scaled = layoutDocument(font(500, { scale: 0.5 }), blocks, 16 * 2 + 36);
    expect(scaled.lines[0]).toBe(1);
    const spaced = layoutDocument(font(500, { letterEm: 0.1 }), [{ tag: 'p', text: 'aa' }], 100);
    expect(spaced.boxes[0]?.height).toBe(16);
    const tall = layoutDocument(
      font(500, { ascent: 0.905, descent: 0.212, lineGap: 0.033 }),
      blocks,
      232,
    );
    expect(tall.boxes[0]?.height).toBe(Math.round(14.48) + Math.round(3.392) + Math.round(0.528));
  });

  it('sizes buttons to their content and adds padding', () => {
    const layout = layoutDocument(font(500), [{ tag: 'button', text: 'aa' }], 300);
    expect(layout.boxes[0]).toMatchObject({ width: 16 + 28, height: 16 + 16 });
  });
});

describe('predictViewport', () => {
  const blocks: Block[] = [
    { tag: 'p', text: 'aaaa aaaa aaaa aaaa' },
    { tag: 'p', text: 'bbbb bbbb' },
  ];

  it('reports no shift for identical fonts and a shift for different ones', () => {
    const viewport = { width: 200, height: 400 };
    expect(predictViewport(font(500), font(500), blocks, viewport).score).toBe(0);
    const result = predictViewport(font(560), font(500), blocks, viewport);
    expect(result.score).toBeGreaterThan(0);
    expect(result.linesAfter).toBeGreaterThan(result.linesBefore);
    expect(result.lineBreakMismatches).toBeGreaterThan(0);
  });

  it('matches a hand-computed single shift', () => {
    const viewport = { width: 168, height: 1000 };
    const result = predictViewport(
      font(500),
      font(500, { ascent: 1.3 }),
      [
        { tag: 'p', text: 'a' },
        { tag: 'p', text: 'a' },
      ],
      viewport,
    );
    expect(result.shiftedElements).toBe(1);
    expect(result.heightBefore).toBeGreaterThan(result.heightAfter);
  });
});

describe('spacing and margins', () => {
  it('adds letter spacing after every character and word spacing to spaces', () => {
    const text = [{ tag: 'p' as const, text: 'aa aa' }];
    expect(layoutDocument(font(500), text, 16 * 2 + 39).lines[0]).toBe(2);
    expect(layoutDocument(font(500), text, 16 * 2 + 40).lines[0]).toBe(1);
    expect(layoutDocument(font(500, { letterEm: -0.05 }), text, 16 * 2 + 39).lines[0]).toBe(1);
    expect(layoutDocument(font(500, { wordEm: 0.1 }), text, 16 * 2 + 40).lines[0]).toBe(2);
  });

  it('collapses the margins between different blocks and indents list items', () => {
    const layout = layoutDocument(
      font(500),
      [
        { tag: 'p', text: 'a' },
        { tag: 'h2', text: 'a' },
        { tag: 'li', text: 'a' },
        { tag: 'h3', text: 'a' },
      ],
      300,
    );
    const [p, h2, li, h3] = layout.boxes;
    expect((h2?.y ?? 0) - ((p?.y ?? 0) + (p?.height ?? 0))).toBe(20);
    expect(li?.x).toBe(16 + 24);
    expect(li?.width).toBe(300 - 32 - 24);
    expect((h3?.y ?? 0) - ((li?.y ?? 0) + (li?.height ?? 0))).toBe(16);
  });

  it('does not break at non-breaking spaces', () => {
    const nbsp = [{ tag: 'p' as const, text: 'aa\u00a0aa aa' }];
    expect(layoutDocument(font(500), nbsp, 16 * 2 + 40).lines[0]).toBe(2);
  });

  it('uses the average advance for glyphs the font lacks', () => {
    const layout = layoutDocument(font(500), [{ tag: 'p', text: 'zzzz' }], 100);
    expect(layout.lines[0]).toBe(1);
    const cyr = layoutDocument(
      font(500),
      [{ tag: 'p', text: 'ёёёёёёёёёёёёёёёё ёёёёёёёёёё' }],
      16 * 2 + 100,
    );
    expect(cyr.lines[0]).toBeGreaterThan(1);
  });
});

describe('textWidth and widthMismatch', () => {
  const font = {
    unitsPerEm: 1000,
    codePoints: [32, 97],
    advances: [250, 500],
    scale: 1,
    ascent: 0.9,
    descent: 0.2,
    lineGap: 0,
    letterEm: 0,
    wordEm: 0,
  };

  it('sums glyph and space widths and scales with the font size', () => {
    expect(textWidth(font, 'aa a', 100)).toBeCloseTo(50 + 50 + 25 + 50);
    expect(textWidth(font, 'aa a', 200)).toBeCloseTo(2 * textWidth(font, 'aa a', 100));
  });

  it('reports no mismatch for the same font and the scale difference otherwise', () => {
    const model = { web: font, language: 'en' as const };
    expect(widthMismatch(model, font)).toBeCloseTo(0);
    expect(widthMismatch(model, { ...font, scale: 1.1 })).toBeCloseTo(0.1, 3);
  });
});
