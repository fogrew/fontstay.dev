import { describe, expect, it } from 'vitest';
import { osFontsDataset } from './dataset';
import { osFontMetrics } from './metrics';
import { fontsAvailableOn, osAvailability } from './query';
import { validateDataset } from './validate';

const byId = (id: string) => {
  const font = osFontsDataset.fonts.find((item) => item.id === id);
  if (!font) throw new Error(`missing ${id}`);
  return font;
};

describe('bundled dataset', () => {
  it('passes schema validation', () => {
    expect(validateDataset(osFontsDataset)).toEqual([]);
  });

  it('gives every availability entry an https source', () => {
    for (const font of osFontsDataset.fonts) {
      for (const entry of font.availability) {
        expect(entry.source.startsWith('https://'), `${font.id} ${entry.os}`).toBe(true);
      }
    }
  });

  it('reflects well-known facts', () => {
    expect(osAvailability(byId('segoe-ui'), 'windows', osFontsDataset).level).toBe('preinstalled');
    expect(osAvailability(byId('segoe-ui'), 'macos', osFontsDataset).level).toBe('unknown');
    expect(osAvailability(byId('helvetica'), 'ios', osFontsDataset).level).toBe('preinstalled');
    expect(osAvailability(byId('tahoma'), 'ios', osFontsDataset).level).toBe('on-demand');
    expect(osAvailability(byId('roboto'), 'android', osFontsDataset).level).toBe('preinstalled');
    expect(osAvailability(byId('liberation-sans'), 'linux', osFontsDataset).level).toBe(
      'preinstalled',
    );
    expect(osAvailability(byId('lato'), 'linux', osFontsDataset).level).toBe('partial');
  });

  it('offers measured cursive system fonts', () => {
    const cursive = osFontsDataset.fonts.filter((font) => font.category === 'cursive');
    expect(cursive.map((font) => font.id)).toEqual(
      expect.arrayContaining(['comic-sans-ms', 'segoe-script']),
    );
    expect(osAvailability(byId('comic-sans-ms'), 'windows', osFontsDataset).level).toBe(
      'preinstalled',
    );
    const measured = new Set(osFontMetrics().map((metrics) => metrics.id));
    for (const font of cursive) expect(measured.has(font.id), font.id).toBe(true);
  });

  it('lists fonts per system', () => {
    const ids = fontsAvailableOn(osFontsDataset, 'windows').map((font) => font.id);
    expect(ids).toContain('arial');
    expect(ids).not.toContain('helvetica');
  });
});

describe('validateDataset', () => {
  const valid = () => structuredClone(osFontsDataset);

  it('rejects a missing source, unknown versions and duplicate ids', () => {
    const noSource = valid();
    const first = noSource.fonts[0];
    if (first?.availability[0]) first.availability[0].source = 'http://example.com';
    expect(validateDataset(noSource).join()).toContain('https URL');

    const badVersion = valid();
    const second = badVersion.fonts[0];
    if (second?.availability[0]) second.availability[0].versions = ['9999'];
    expect(validateDataset(badVersion).join()).toContain('unknown version 9999');

    const duplicate = valid();
    duplicate.fonts.push(structuredClone(byId('arial')));
    expect(validateDataset(duplicate).join()).toContain('duplicated');
  });

  it('rejects wrong shapes', () => {
    expect(validateDataset(null)).not.toEqual([]);
    expect(validateDataset({ schema: 2 })).not.toEqual([]);
    const unknownOs = valid();
    const font = unknownOs.fonts[0];
    if (font?.availability[0]) (font.availability[0] as { os: string }).os = 'beos';
    expect(validateDataset(unknownOs).join()).toContain('os is unknown');
  });
});

describe('osAvailability', () => {
  const platforms = { windows: { versions: ['10', '11'] } } as never;
  const font = (versions: string[], status: 'preinstalled' | 'on-demand') => ({
    id: 'x',
    family: 'X',
    category: 'sans-serif' as const,
    availability: [{ os: 'windows' as const, versions, status, source: 'https://example.com' }],
  });

  it('distinguishes full, partial, on-demand and unknown', () => {
    expect(osAvailability(font(['10', '11'], 'preinstalled'), 'windows', { platforms }).level).toBe(
      'preinstalled',
    );
    expect(osAvailability(font(['10'], 'preinstalled'), 'windows', { platforms }).level).toBe(
      'partial',
    );
    expect(osAvailability(font(['10', '11'], 'on-demand'), 'windows', { platforms }).level).toBe(
      'on-demand',
    );
    expect(osAvailability(font([], 'on-demand'), 'windows', { platforms }).level).toBe('unknown');
  });
});
