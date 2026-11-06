import { describe, expect, it } from 'vitest';
import { languageWeights, systemFonts } from '@/modules/fallback-fit';
import { osFontsDataset } from './dataset';
import { decodeMetrics, osFontMetrics } from './metrics';

const byId = (id: string) => {
  const font = osFontMetrics().find((item) => item.id === id);
  if (!font) throw new Error(`missing ${id}`);
  return font;
};

function averageWidthEm(id: string, language: 'en' | 'ru'): number {
  const font = byId(id);
  const advance = new Map<number, number>();
  for (const [index, cp] of font.codePoints.entries()) advance.set(cp, font.advances[index] ?? 0);
  let width = 0;
  let total = 0;
  for (const { codePoint, weight } of languageWeights(language)) {
    const value = advance.get(codePoint);
    if (value === undefined) continue;
    width += weight * (value / font.unitsPerEm);
    total += weight;
  }
  return width / total;
}

describe('bundled metrics', () => {
  it('belongs to families that exist in the availability dataset', () => {
    const ids = new Set(osFontsDataset.fonts.map((font) => font.id));
    for (const font of osFontMetrics()) expect(ids.has(font.id), font.id).toBe(true);
  });

  it('carries shaped width ratios for every face and language', () => {
    for (const font of osFontMetrics()) {
      for (const face of [font, ...Object.values(font.variants)]) {
        for (const language of ['en', 'ru']) {
          expect(face.ratios?.[language], `${font.id} ${language}`).toBeGreaterThan(0.5);
        }
      }
    }
  });

  it('keeps sorted code points and positive units per em', () => {
    for (const font of osFontMetrics()) {
      expect(font.unitsPerEm, font.id).toBeGreaterThan(0);
      for (let index = 1; index < font.codePoints.length; index++) {
        expect(font.codePoints[index], font.id).toBeGreaterThan(font.codePoints[index - 1] ?? 0);
      }
    }
  });

  it('agrees with the Capsize-based system fonts on vertical metrics and Latin width', () => {
    for (const system of systemFonts) {
      const own = osFontMetrics().find(
        (font) => font.family.toLowerCase() === system.family.toLowerCase(),
      );
      if (!own) continue;
      expect(own.hhea, system.family).toEqual(system.metrics.hhea);
      expect(averageWidthEm(own.id, 'en') / system.latinWidthEm, system.family).toBeGreaterThan(
        0.97,
      );
      expect(averageWidthEm(own.id, 'en') / system.latinWidthEm, system.family).toBeLessThan(1.03);
    }
  });

  it('covers Cyrillic where the font supports it', () => {
    expect(averageWidthEm('arial', 'ru')).toBeGreaterThan(0.3);
    expect(averageWidthEm('liberation-sans', 'ru')).toBeGreaterThan(0.3);
  });
});

describe('decodeMetrics', () => {
  it('expands code point runs and rejects inconsistent entries', () => {
    const base = {
      id: 'x',
      family: 'X',
      source: { kind: 'local' as const, file: 'x.ttf', sha256: '0' },
      localNames: [],
      unitsPerEm: 1000,
      hhea: { ascent: 1, descent: -1, lineGap: 0 },
      typo: null,
      win: null,
      isVariable: false,
    };
    const ok = decodeMetrics({ ...base, codePoints: [65, 2, 97, 1], advances: [1, 2, 3] });
    expect([...ok.codePoints]).toEqual([65, 66, 97]);
    expect(() => decodeMetrics({ ...base, codePoints: [65, 2], advances: [1] })).toThrow();
  });
});
