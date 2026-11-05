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
  lensShows: fc.constantFrom(...LENS_SHOWS),
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
