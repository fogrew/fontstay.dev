import { describe, expect, it } from 'vitest';
import { decodeShareState, encodeShareState, parseShareState } from './share';
import {
  buildShareState,
  dataVersionOf,
  diffPicks,
  isStaleLink,
  mergePicks,
  withoutPicks,
} from './share-build';

const preset = { windows: ['arial', 'segoe-ui'], macos: ['helvetica'] };

describe('buildShareState', () => {
  it('serializes nothing for the defaults', () => {
    expect(
      buildShareState({
        selected: { picks: {}, manual: {} },
        others: {},
        disabled: [],
        range: false,
        perScript: true,
        spacing: { on: true },
        panel: 'inputs',
        view: {},
      }),
    ).toEqual({ v: 1 });
  });

  it('keeps a small link small', async () => {
    const payload = await encodeShareState(buildShareState({ fontName: 'Inter.woff2' }));
    expect(payload.length).toBeLessThan(60);
  });

  it('drops picks equal to the preset and keeps the differences', () => {
    expect(diffPicks(preset, preset)).toBeUndefined();
    expect(diffPicks({ ...preset, windows: ['arial'], linux: [] }, preset)).toEqual({
      windows: ['arial'],
    });
    expect(diffPicks({ windows: [] }, preset)).toEqual({ windows: [], macos: [] });
  });

  it('merges the saved differences over the preset picks', () => {
    const saved = diffPicks({ ...preset, windows: ['arial'] }, preset);
    expect(mergePicks(preset, saved)).toEqual({ ...preset, windows: ['arial'] });
    expect(mergePicks(preset, undefined)).toEqual(preset);
  });

  it('marks a link made in the all-fonts mode', () => {
    expect(buildShareState({ all: true }).all).toBe(true);
    expect(parseShareState({ v: 1, all: true })?.all).toBe(true);
    expect(buildShareState({ all: false }).all).toBeUndefined();
  });

  it('records the panel only when it is not the default, including a closed dock', () => {
    expect(buildShareState({ panel: 'tuning' }).panel).toBe('tuning');
    expect(buildShareState({ panel: 'none' }).panel).toBe('none');
    expect(buildShareState({ panel: 'inputs' }).panel).toBeUndefined();
  });

  it('records spacing only when it is off or manual', () => {
    expect(buildShareState({ spacing: { on: false } }).spacing).toEqual({ on: false });
    expect(buildShareState({ spacing: { on: true, letter: 0.2 } }).spacing).toEqual({
      on: true,
      letter: 0.2,
    });
  });

  it('round-trips the full state through the link', async () => {
    const state = buildShareState({
      query: 'defaults',
      fontName: 'Inter.woff2',
      all: false,
      preset: 'system',
      basePicks: preset,
      selected: {
        kind: 'serif',
        style: 'bold',
        picks: { ...preset, windows: ['arial'] },
        manual: { arial: { sizeAdjust: 101.5 } },
      },
      others: {
        'Inter-Italic.woff2': { style: 'italic', picks: preset },
        'Empty.woff2': {},
      },
      sources: [{ source: 'google', family: 'Inter', style: '400', subset: 'latin' }],
      disabled: ['linux'],
      range: true,
      perScript: false,
      spacing: { on: true, word: 1 },
      panel: 'export',
      os: 'macos',
      face: 'helvetica',
      view: { mode: 'side', size: 22, layers: { fallback: { color: 'red' } } },
    });
    expect(state.others).toEqual({ 'Inter-Italic.woff2': { style: 'italic' } });
    expect(state.picks).toEqual({ windows: ['arial'] });
    expect(await decodeShareState(await encodeShareState(state))).toEqual(state);
    expect(parseShareState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });
});

describe('older links', () => {
  it('still parse and restore the fields they carried', () => {
    expect(
      parseShareState({
        v: 1,
        picks: { windows: ['arial'] },
        manual: {},
        others: {},
        disabled: [],
        range: false,
        spacing: { on: true },
      }),
    ).toEqual({
      v: 1,
      picks: { windows: ['arial'] },
      manual: {},
      others: {},
      disabled: [],
      range: false,
      spacing: { on: true },
    });
  });
});

describe('data version', () => {
  const picks = { a: { windows: ['arial'] }, b: { macos: ['menlo'] } };

  it('is stable, order-independent and sensitive to a changed pick', () => {
    const version = dataVersionOf(picks);
    expect(version).toMatch(/^[0-9a-f]{8}$/);
    expect(dataVersionOf({ b: picks.b, a: picks.a })).toBe(version);
    expect(dataVersionOf({ ...picks, a: { windows: ['arial', 'segoe-ui'] } })).not.toBe(version);
    expect(dataVersionOf({ ...picks, c: {} })).not.toBe(version);
  });

  it('round-trips through the link and is optional', () => {
    expect(parseShareState(buildShareState({ data: 'deadbeef' }))?.data).toBe('deadbeef');
    expect(parseShareState({ v: 1, data: 'nope' })?.data).toBeUndefined();
    expect(parseShareState({ v: 1, data: 7 })?.data).toBeUndefined();
    expect(buildShareState({})).toEqual({ v: 1 });
  });

  it('treats only a different version as stale', () => {
    expect(isStaleLink({ v: 1 }, 'deadbeef')).toBe(false);
    expect(isStaleLink({ v: 1, data: 'deadbeef' }, 'deadbeef')).toBe(false);
    expect(isStaleLink({ v: 1, data: '00000000' }, 'deadbeef')).toBe(true);
  });

  it('removes picks but keeps the other choices', () => {
    const state = {
      v: 1,
      data: '00000000',
      preset: 'system-ui',
      picks: { windows: ['arial'] },
      manual: { arial: { sizeAdjust: 100 } },
      others: { 'a.woff2': { picks: { macos: ['menlo'] }, style: 'bold' as const } },
    };
    expect(withoutPicks(state)).toEqual({
      v: 1,
      data: '00000000',
      preset: 'system-ui',
      manual: { arial: { sizeAdjust: 100 } },
      others: { 'a.woff2': { style: 'bold' } },
    });
  });
});
