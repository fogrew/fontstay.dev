import { describe, expect, it } from 'vitest';
import { font } from './font.test-util';
import { rankFor } from './per-os';
import { detectScripts, primaryScript, scriptFaces, scriptWeights } from './scripts';

const latin = Array.from({ length: 95 }, (_, index) => 0x20 + index);
const cyrillic = Array.from({ length: 64 }, (_, index) => 0x410 + index);

function mixed(latinAdvance: number, cyrillicAdvance: number) {
  const web = font([...latin, ...cyrillic], latinAdvance);
  web.advances = Float64Array.from(web.codePoints, (codePoint) =>
    codePoint >= 0x400 ? cyrillicAdvance : latinAdvance,
  );
  return web;
}

describe('detectScripts', () => {
  it('finds the scripts that have enough letters', () => {
    expect(detectScripts(Uint32Array.from(latin))).toEqual(['latin']);
    expect(detectScripts(Uint32Array.from([...latin, ...cyrillic]))).toEqual(['latin', 'cyrillic']);
    expect(detectScripts(Uint32Array.from([0x41, 0x42, 0x410]))).toEqual([]);
  });
});

describe('scriptWeights', () => {
  it('keeps letters of the script only', () => {
    const weights = scriptWeights('cyrillic');
    expect(weights.length).toBeGreaterThan(30);
    expect(weights.every(({ codePoint }) => codePoint >= 0x400 && codePoint <= 0x4ff)).toBe(true);
    expect(scriptWeights('latin').every(({ codePoint }) => codePoint < 0x250)).toBe(true);
  });
});

describe('scriptFaces', () => {
  const candidateFor = (web: ReturnType<typeof font>) => {
    const arial = rankFor(web, 'windows', 'en').candidates.find((item) => item.id === 'arial');
    if (!arial) throw new Error('no Arial');
    return arial;
  };

  it('adds a Cyrillic face when its letters are proportionally wider than Latin ones', () => {
    const web = mixed(520, 760);
    const arial = candidateFor(web);
    const faces = scriptFaces(web, arial.fit, 'en', arial.adjustment, arial.adjustment);
    const [face] = faces;
    expect(faces).toHaveLength(1);
    expect(face?.script).toBe('cyrillic');
    expect(face?.unicodeRange).toContain('U+400-52F');
    expect(
      scriptFaces(web, arial.fit, 'ru', arial.adjustment, arial.adjustment)[0]?.unicodeRange,
    ).toMatch(/^U\+41-5A, U\+61-7A/);
    expect(face?.adjustment.sizeAdjust).toBeGreaterThan(arial.adjustment.sizeAdjust * 1.01);
    const ratio = arial.adjustment.sizeAdjust / (face?.adjustment.sizeAdjust ?? 1);
    expect(face?.adjustment.ascentOverride).toBeCloseTo(arial.adjustment.ascentOverride * ratio, 6);
  });

  it('adds nothing when every script scales alike', () => {
    const web = mixed(520, 520);
    const arial = candidateFor(web);
    const proportional = scriptFaces(web, arial.fit, 'en', arial.adjustment, arial.adjustment);
    expect(proportional.every((face) => face.script !== 'latin')).toBe(true);
    expect(
      scriptFaces(font(latin, 520), arial.fit, 'en', arial.adjustment, arial.adjustment),
    ).toEqual([]);
  });

  it('follows the applied size when the fit was tuned by hand', () => {
    const web = mixed(520, 760);
    const arial = candidateFor(web);
    const tuned = { ...arial.adjustment, sizeAdjust: arial.adjustment.sizeAdjust * 1.1 };
    const [plain] = scriptFaces(web, arial.fit, 'en', arial.adjustment, arial.adjustment);
    const [scaled] = scriptFaces(web, arial.fit, 'en', arial.adjustment, tuned);
    expect((scaled?.adjustment.sizeAdjust ?? 0) / (plain?.adjustment.sizeAdjust ?? 1)).toBeCloseTo(
      1.1,
      6,
    );
  });

  it('limits the script range to the characters of the font when asked to', () => {
    const web = mixed(520, 760);
    const arial = candidateFor(web);
    const [face] = scriptFaces(web, arial.fit, 'en', arial.adjustment, arial.adjustment, true);
    expect(face?.unicodeRange).toBe('U+410-44F');
  });

  it('uses Cyrillic as the primary script for Russian', () => {
    expect(primaryScript('ru')).toBe('cyrillic');
    expect(primaryScript('en')).toBe('latin');
  });
});
