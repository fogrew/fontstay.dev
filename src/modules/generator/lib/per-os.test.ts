import { beforeAll, describe, expect, it } from 'vitest';
import { loadVariantMetrics } from '@/modules/os-fonts';
import { font } from './font.test-util';
import { planStack, rankFor, styleKeyOf, systemsWithFonts } from './per-os';

const ascii = Array.from({ length: 95 }, (_, index) => 0x20 + index);
const cyrillic = Array.from({ length: 64 }, (_, index) => 0x410 + index);

describe('rankFor', () => {
  it('lists only fonts preinstalled on the system, closest width first within full coverage', () => {
    const windows = rankFor(font(ascii, 520), 'windows', 'en').candidates.map((item) => item.id);
    expect(windows).toContain('arial');
    expect(windows).toContain('segoe-ui');
    expect(windows).not.toContain('roboto');
    expect(windows).not.toContain('helvetica');

    const android = rankFor(font(ascii, 520), 'android', 'en').candidates.map((item) => item.id);
    expect(android).toContain('roboto');
    expect(android).not.toContain('arial');

    const sizes = rankFor(font(ascii, 520), 'windows', 'en').candidates.map((item) =>
      Math.abs(Math.log(item.adjustment.sizeAdjust)),
    );
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
  });

  it('offers the Latin-only Helvetica on Apple systems for English only', () => {
    const english = rankFor(font(ascii, 520), 'macos', 'en').candidates;
    const helvetica = english.find((item) => item.id === 'helvetica');
    expect(helvetica?.latinOnly).toBe(true);
    const russian = rankFor(font([...ascii, ...cyrillic], 520), 'macos', 'ru').candidates;
    expect(russian.some((item) => item.id === 'helvetica')).toBe(false);
  });

  it('measures Cyrillic coverage from real advances', () => {
    const web = font([...ascii, ...cyrillic], 520);
    const ranking = rankFor(web, 'windows', 'ru');
    const arial = ranking.candidates.find((item) => item.id === 'arial');
    expect(arial?.coverage).toBeGreaterThan(0.95);
    expect(arial?.latinOnly).toBe(false);
  });

  it('knows which systems have candidates', () => {
    const systems = systemsWithFonts();
    expect(systems).toEqual(
      expect.arrayContaining(['windows', 'macos', 'ios', 'android', 'linux', 'chromeos']),
    );
  });
});

describe('planStack', () => {
  it('orders faces by share and matches every system when nothing overlaps', () => {
    const plan = planStack([
      { os: 'android', share: 60, faceId: 'roboto' },
      { os: 'windows', share: 30, faceId: 'segoe-ui' },
    ]);
    expect(plan.order).toEqual(['roboto', 'segoe-ui']);
    expect(plan.resolution.platforms.every((item) => item.status === 'matched')).toBe(true);
    expect(plan.resolution.suggestion).toBeNull();
  });

  it('reports shadowing and proposes a reorder when a font exists on another system', () => {
    const picks = [
      { os: 'windows' as const, share: 60, faceId: 'arial' },
      { os: 'macos' as const, share: 30, faceId: 'helvetica' },
    ];
    const plan = planStack(picks);
    expect(plan.order).toEqual(['arial', 'helvetica']);
    const macos = plan.resolution.platforms.find((item) => item.platform === 'macos');
    expect(macos?.status).toBe('shadowed');
    expect(plan.resolution.suggestion?.order).toEqual(['helvetica', 'arial']);
    const fixed = planStack(picks, plan.resolution.suggestion?.order);
    expect(fixed.resolution.platforms.every((item) => item.status === 'matched')).toBe(true);
  });

  it('reports a cycle when two systems need opposite orders', () => {
    const plan = planStack([
      { os: 'windows', share: 60, faceId: 'arial' },
      { os: 'macos', share: 30, faceId: 'georgia' },
    ]);
    expect(plan.resolution.blockedBy).toBe('cycle');
    expect(plan.resolution.suggestion).toBeNull();
  });

  it('models every rank per system and proposes an order satisfying all of them', () => {
    const picks = [
      { os: 'windows' as const, share: 60, faceId: 'segoe-ui' },
      { os: 'windows' as const, share: 60, faceId: 'arial' },
      { os: 'macos' as const, share: 30, faceId: 'helvetica' },
    ];
    const plan = planStack(picks);
    expect(plan.order).toEqual(['segoe-ui', 'arial', 'helvetica']);
    const shadowed = plan.resolution.platforms.filter((item) => item.status === 'shadowed');
    expect(shadowed.map((item) => item.platform)).toEqual(['macos']);
    expect(plan.resolution.suggestion?.order).toEqual(['segoe-ui', 'helvetica', 'arial']);
    const fixed = planStack(picks, plan.resolution.suggestion?.order);
    expect(fixed.resolution.platforms.map((item) => item.platform)).toEqual([
      'windows',
      'windows#2',
      'macos',
    ]);
    expect(fixed.resolution.platforms.every((item) => item.status === 'matched')).toBe(true);
  });

  it('reports a cycle when two systems rank the same fonts in opposite order', () => {
    const plan = planStack([
      { os: 'windows', share: 60, faceId: 'arial' },
      { os: 'windows', share: 60, faceId: 'georgia' },
      { os: 'macos', share: 30, faceId: 'georgia' },
      { os: 'macos', share: 30, faceId: 'arial' },
    ]);
    expect(plan.resolution.blockedBy).toBe('cycle');
  });

  it('throws a typed error beyond the face limit instead of crashing later', () => {
    const many = rankFor(font(ascii, 520), 'windows', 'en').candidates.map((item) => ({
      os: 'windows' as const,
      share: 10,
      faceId: item.id,
    }));
    const more = ['android', 'macos', 'linux'].flatMap((os) =>
      rankFor(font(ascii, 520), os as 'android', 'en').candidates.map((item) => ({
        os: os as 'android',
        share: 5,
        faceId: item.id,
      })),
    );
    const faces = new Set([...many, ...more].map((pick) => pick.faceId));
    if (faces.size > 16) expect(() => planStack([...many, ...more])).toThrow();
    else expect(planStack([...many, ...more]).order.length).toBe(faces.size);
  });

  it('ignores an order that does not list the same faces', () => {
    const plan = planStack([{ os: 'android', share: 1, faceId: 'roboto' }], ['nope']);
    expect(plan.order).toEqual(['roboto']);
  });
});

describe('rankFor with a style', () => {
  beforeAll(async () => {
    await loadVariantMetrics();
  });

  it('classifies the web font style', () => {
    expect(styleKeyOf({ weight: 400, italic: false })).toBe('regular');
    expect(styleKeyOf({ weight: 700, italic: false })).toBe('bold');
    expect(styleKeyOf({ weight: 300, italic: true })).toBe('italic');
    expect(styleKeyOf({ weight: 800, italic: true })).toBe('bold-italic');
  });

  it('uses the bold face metrics and local names when the font has them', () => {
    const web = font(ascii, 520);
    const regular = rankFor(web, 'windows', 'en').candidates.find((item) => item.id === 'arial');
    const bold = rankFor(web, 'windows', 'en', 'bold').candidates.find(
      (item) => item.id === 'arial',
    );
    expect(bold?.style).toBe('bold');
    expect(bold?.localNames).toContain('Arial Bold');
    expect(bold?.adjustment.sizeAdjust).not.toBe(regular?.adjustment.sizeAdjust);
  });

  it('keeps the regular face where no bold metrics exist', () => {
    const candidates = rankFor(font(ascii, 520), 'macos', 'en', 'bold').candidates;
    expect(candidates.find((item) => item.id === 'helvetica')?.style).toBe('regular');
  });
});
