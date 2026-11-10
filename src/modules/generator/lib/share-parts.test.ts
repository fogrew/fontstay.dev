import { describe, expect, it } from 'vitest';
import { parseShareState, SHARE_VERSION, type ShareState } from './share';
import { SHARE_PARTS, sharePartsIn, withoutShareParts } from './share-parts';

const full: ShareState = {
  v: SHARE_VERSION,
  data: '0123abcd',
  query: 'inter',
  fontName: 'Inter.woff2',
  all: true,
  sources: [{ source: 'google', family: 'Inter', style: '400', subset: 'latin' }],
  preset: 'web',
  kind: 'serif',
  style: 'bold',
  picks: { windows: ['arial'] },
  manual: { arial: { sizeAdjust: 100 } },
  disabled: ['linux'],
  others: { 'Other.woff2': { kind: 'monospace', picks: { macos: ['menlo'] }, manual: {} } },
  range: true,
  scripts: false,
  spacing: { on: false, letter: 1 },
  panel: 'export',
  os: 'macos',
  face: 'regular',
  view: { mode: 'overlay', size: 20, frame: 400, headingFont: 'Lora', bodyFont: 'Inter' },
};

describe('sharePartsIn', () => {
  it('lists nothing for the defaults', () => {
    expect(sharePartsIn({ v: SHARE_VERSION, data: '0123abcd' })).toEqual([]);
  });

  it('lists every part a link stores', () => {
    expect(sharePartsIn(full)).toEqual([...SHARE_PARTS]);
  });

  it('keeps site fonts apart from the other preview settings', () => {
    expect(sharePartsIn({ v: 1, view: { headingFont: 'Lora' } })).toEqual(['siteFonts']);
    expect(sharePartsIn({ v: 1, view: { size: 20 } })).toEqual(['preview']);
  });

  it('counts the emoji option as tuning and drops it with the Tuning part', () => {
    const state = { v: 1 as const, emoji: true };
    expect(sharePartsIn(state)).toEqual(['tuning']);
    expect(withoutShareParts(state, ['tuning']).emoji).toBeUndefined();
  });

  it('counts fit values of other fonts as tuning', () => {
    expect(
      sharePartsIn({ v: 1, others: { 'A.woff2': { manual: { x: { sizeAdjust: 90 } } } } }),
    ).toEqual(['fonts', 'tuning']);
  });
});

describe('withoutShareParts', () => {
  it('returns the state unchanged when nothing is excluded', () => {
    expect(withoutShareParts(full, [])).toBe(full);
  });

  it('keeps only the version and data stamp when everything is excluded', () => {
    expect(withoutShareParts(full, SHARE_PARTS)).toEqual({ v: SHARE_VERSION, data: '0123abcd' });
  });

  it('removes one part at a time and nothing else', () => {
    for (const part of SHARE_PARTS) {
      const left = withoutShareParts(full, [part]);
      expect(sharePartsIn(left)).toEqual(SHARE_PARTS.filter((item) => item !== part));
      expect(left.data).toBe('0123abcd');
    }
  });

  it('removes the font choices of other fonts by part', () => {
    const left = withoutShareParts(full, ['style', 'tuning']);
    expect(left.others).toEqual({ 'Other.woff2': { picks: { macos: ['menlo'] } } });
    expect(left.manual).toBeUndefined();
    expect(left.picks).toEqual({ windows: ['arial'] });
  });

  it('drops the other fonts with the fonts part', () => {
    expect(withoutShareParts(full, ['fonts']).others).toBeUndefined();
  });

  it('produces a state the recipient parser accepts', () => {
    for (const part of SHARE_PARTS) {
      const parsed = parseShareState(withoutShareParts(full, [part]));
      expect(parsed?.v).toBe(SHARE_VERSION);
      expect(parsed?.data).toBe('0123abcd');
    }
  });
});
