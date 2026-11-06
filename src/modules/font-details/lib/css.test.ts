import { describe, expect, it } from 'vitest';
import { buildDetailsCss, changedFeatures } from './css';
import { isDefaultOn } from './default-on';
import { classifyFeature } from './features';

const axes = [
  { tag: 'wght', name: 'Weight', min: 100, default: 400, max: 900 },
  { tag: 'wdth', name: 'Width', min: 75, default: 100, max: 125 },
];

const css = (features: Record<string, boolean> = {}, values: Record<string, number> = {}) =>
  buildDetailsCss(axes, { features, axes: values });

describe('buildDetailsCss', () => {
  it('emits nothing for the default state', () => {
    expect(css()).toBe('');
    expect(css({ liga: true, kern: true, smcp: false }, { wght: 400 })).toBe('');
  });

  it('maps single features to font-variant values', () => {
    expect(css({ smcp: true })).toBe('font-variant-caps: small-caps;');
    expect(css({ onum: true, tnum: true })).toBe(
      'font-variant-numeric: oldstyle-nums tabular-nums;',
    );
    expect(css({ sups: true })).toBe('font-variant-position: super;');
    expect(css({ dlig: true })).toBe('font-variant-ligatures: discretionary-ligatures;');
    expect(css({ zero: true, frac: true, ordn: true })).toBe(
      'font-variant-numeric: diagonal-fractions ordinal slashed-zero;',
    );
  });

  it('uses the two-feature caps values only when both features are on', () => {
    expect(css({ smcp: true, c2sc: true })).toBe('font-variant-caps: all-small-caps;');
    expect(css({ pcap: true, c2pc: true })).toBe('font-variant-caps: all-petite-caps;');
    expect(css({ c2sc: true })).toBe('font-feature-settings: "c2sc" 1;');
  });

  it('keeps conflicting features in font-feature-settings', () => {
    expect(css({ smcp: true, pcap: true })).toBe('font-feature-settings: "pcap" 1, "smcp" 1;');
    expect(css({ lnum: true, onum: true })).toBe('font-feature-settings: "lnum" 1, "onum" 1;');
  });

  it('turns default-on features off', () => {
    expect(css({ liga: false, clig: false })).toBe('font-variant-ligatures: no-common-ligatures;');
    expect(css({ calt: false })).toBe('font-variant-ligatures: no-contextual;');
    expect(css({ liga: false })).toBe('font-feature-settings: "liga" 0;');
    expect(css({ kern: false })).toBe('font-feature-settings: "kern" 0;');
  });

  it('combines ligature values on one property', () => {
    expect(css({ liga: false, clig: false, calt: false, dlig: true })).toBe(
      'font-variant-ligatures: no-common-ligatures no-contextual discretionary-ligatures;',
    );
  });

  it('writes the other features sorted into font-feature-settings', () => {
    expect(css({ ss03: true, cv12: true, ss01: true })).toBe(
      'font-feature-settings: "cv12" 1, "ss01" 1, "ss03" 1;',
    );
  });

  it('writes the axes that differ from the default', () => {
    expect(css({}, { wght: 650, wdth: 100 })).toBe('font-variation-settings: "wght" 650;');
    expect(css({}, { wght: 650.12345, wdth: 80 })).toBe(
      'font-variation-settings: "wght" 650.123, "wdth" 80;',
    );
  });

  it('clamps axis values and ignores unknown or invalid axes', () => {
    expect(css({}, { wght: 5000 })).toBe('font-variation-settings: "wght" 900;');
    expect(css({}, { wght: Number.NaN, slnt: 3 })).toBe('');
  });

  it('orders the three properties', () => {
    expect(css({ smcp: true, ss01: true }, { wght: 700 })).toBe(
      [
        'font-variant-caps: small-caps;',
        'font-feature-settings: "ss01" 1;',
        'font-variation-settings: "wght" 700;',
      ].join('\n'),
    );
  });
});

describe('changedFeatures', () => {
  it('lists only deviations from the default sorted by tag', () => {
    expect(changedFeatures({ zero: true, liga: true, kern: false, ss01: false })).toEqual([
      { tag: 'kern', on: false },
      { tag: 'zero', on: true },
    ]);
  });
});

describe('feature catalog', () => {
  it('knows the default-on features', () => {
    expect(isDefaultOn('liga')).toBe(true);
    expect(isDefaultOn('smcp')).toBe(false);
  });

  it('classifies tags', () => {
    expect(classifyFeature('liga')).toEqual({ kind: 'known', tag: 'liga' });
    expect(classifyFeature('ss07')).toEqual({ kind: 'stylistic-set', number: 7 });
    expect(classifyFeature('ss21')).toEqual({ kind: 'unknown' });
    expect(classifyFeature('cv99')).toEqual({ kind: 'character-variant', number: 99 });
    expect(classifyFeature('init')).toEqual({ kind: 'joining' });
    expect(classifyFeature('rphf')).toEqual({ kind: 'shaping' });
    expect(classifyFeature('xxxx')).toEqual({ kind: 'unknown' });
  });
});
