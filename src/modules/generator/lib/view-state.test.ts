import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ARTICLE_IDS } from './articles';
import { GUIDES } from './guides';
import { PRESET_IDS } from './layers';
import {
  applyView,
  COLORS,
  defaultView,
  diffView,
  LENS_SHOWS,
  lensDefault,
  type PreviewView,
  parseViewDiff,
  RENDERS,
  SUBSTITUTES,
  WRAPS,
} from './view-state';

const base = defaultView('en');

const layer = fc.record({
  render: fc.constantFrom(...RENDERS),
  color: fc.constantFrom(...COLORS),
  width: fc.double({ min: 0.5, max: 4, noNaN: true }),
  opacity: fc.integer({ min: 0, max: 100 }),
});

const view = fc.record<PreviewView>({
  article: fc.constantFrom(...ARTICLE_IDS),
  mode: fc.constantFrom(...PRESET_IDS),
  stacked: fc.boolean(),
  xray: fc.boolean(),
  lensShows: fc.option(fc.constantFrom(...LENS_SHOWS), { nil: undefined }),
  lensSize: fc.integer({ min: 80, max: 400 }),
  guides: fc.subarray([...GUIDES]).map((list) => GUIDES.filter((id) => list.includes(id))),
  boxes: fc.boolean(),
  size: fc.integer({ min: 12, max: 32 }),
  lineHeight: fc.double({ min: 1, max: 2.4, noNaN: true }),
  wrap: fc.constantFrom(...WRAPS),
  substitute: fc.constantFrom(...SUBSTITUTES),
  headingFont: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: undefined }),
  bodyFont: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: undefined }),
  layers: fc.record({ web: layer, fallback: layer }),
  split: fc.double({ min: 0, max: 100, noNaN: true }),
  frame: fc.option(fc.integer({ min: 320, max: 10_000 }), { nil: undefined }),
});

describe('view defaults', () => {
  it('opens on the slider with the lens on', () => {
    expect(base.mode).toBe('slider');
    expect(base.xray).toBe(true);
    expect(base.lensShows).toBeUndefined();
  });

  it('shows the adjusted fallback in comparisons and the opposite view otherwise', () => {
    for (const mode of ['slider', 'overlay', 'side'] as const) {
      expect(lensDefault(mode)).toBe('fallback');
    }
    expect(lensDefault('web')).toBe('fallback');
    expect(lensDefault('fallback')).toBe('web');
    expect(lensDefault('plain')).toBe('web');
  });

  it('still reads links that name the old defaults explicitly', () => {
    const diff = parseViewDiff({ mode: 'overlay', xray: false, lensShows: 'overlay' }) ?? {};
    expect(applyView(base, diff)).toMatchObject({
      mode: 'overlay',
      xray: false,
      lensShows: 'overlay',
    });
  });
});

describe('view diff', () => {
  it('is empty for the defaults', () => {
    expect(diffView(base, base)).toEqual({});
  });

  it('keeps only what differs', () => {
    expect(diffView({ ...base, mode: 'side', size: 20 }, base)).toEqual({ mode: 'side', size: 20 });
    const layers = { ...base.layers, web: { ...base.layers.web, opacity: 40 } };
    expect(diffView({ ...base, layers }, base)).toEqual({ layers: { web: { opacity: 40 } } });
  });

  it('round-trips any view through the diff and the parser', () => {
    fc.assert(
      fc.property(view, (value) => {
        const diff = diffView(value, base);
        const parsed = parseViewDiff(JSON.parse(JSON.stringify(diff)));
        expect(applyView(base, parsed ?? {})).toEqual(applyView(base, diff));
        expect(applyView(base, diff)).toEqual(value);
      }),
    );
  });
});

describe('parseViewDiff', () => {
  it('drops unknown keys and out-of-range values', () => {
    expect(
      parseViewDiff({
        mode: 'nope',
        size: 99,
        lineHeight: Number.NaN,
        wrap: 'balance',
        guides: ['x', 'evil', 'x'],
        layers: { web: { color: 'pink', opacity: 50, width: 99 }, __proto__: { opacity: 1 } },
        headingFont: 'x'.repeat(201),
        frame: 10,
        extra: 1,
      }),
    ).toEqual({ wrap: 'balance', guides: ['x'], layers: { web: { opacity: 50 } } });
  });

  it('never throws for arbitrary input', () => {
    fc.assert(fc.property(fc.anything(), (input) => void parseViewDiff(input)));
  });
});
