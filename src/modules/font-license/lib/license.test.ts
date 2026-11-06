import { describe, expect, it } from 'vitest';
import { analyzeLicense, embeddingLevel, licenseKind, reservedFontNames } from './license';

const base = { copyright: null, trademark: null, license: null, licenseUrl: null, fsType: 0 };

describe('licenseKind', () => {
  it.each([
    ['This Font Software is licensed under the SIL Open Font License, Version 1.1.', null, 'ofl'],
    [null, 'http://scripts.sil.org/OFL', 'ofl'],
    [null, 'https://openfontlicense.org', 'ofl'],
    ['Licensed under the Apache License, Version 2.0', null, 'apache'],
    [null, 'https://www.apache.org/licenses/LICENSE-2.0', 'apache'],
    ['MIT License', null, 'mit'],
    [null, 'https://opensource.org/licenses/MIT', 'mit'],
    ['Ubuntu Font Licence 1.0', null, 'ubuntu'],
    [null, 'https://creativecommons.org/publicdomain/zero/1.0/', 'cc0'],
    ['CC0 1.0 Universal', null, 'cc0'],
    ['Proprietary, all rights reserved', null, 'unknown'],
    [null, null, 'none'],
    ['   ', '', 'none'],
  ] as const)('%s %s -> %s', (license, url, kind) => {
    expect(licenseKind(license, url)).toBe(kind);
  });
});

describe('embeddingLevel', () => {
  it('maps fsType bits, most restrictive first', () => {
    expect(embeddingLevel(null)).toBeNull();
    expect(embeddingLevel(0)).toBe('installable');
    expect(embeddingLevel(2)).toBe('restricted');
    expect(embeddingLevel(4)).toBe('preview-print');
    expect(embeddingLevel(8)).toBe('editable');
    expect(embeddingLevel(0x0c)).toBe('preview-print');
    expect(embeddingLevel(0x0e)).toBe('restricted');
    expect(embeddingLevel(0x0100)).toBe('installable');
  });
});

describe('reservedFontNames', () => {
  it('finds quoted names and the bare statement', () => {
    expect(reservedFontNames(['Copyright 2010 Adobe, with Reserved Font Name "Source".'])).toEqual({
      present: true,
      names: ['Source'],
    });
    expect(reservedFontNames(['with Reserved Font Names “Foo” and “Bar Sans”.'])).toEqual({
      present: true,
      names: ['Foo', 'Bar Sans'],
    });
    expect(reservedFontNames(['Reserved Font Name applies'])).toEqual({ present: true, names: [] });
    expect(reservedFontNames([null, 'plain copyright'])).toEqual({ present: false, names: [] });
  });
});

describe('analyzeLicense', () => {
  it('allows everything for an installable OFL font without a reserved name', () => {
    const info = analyzeLicense({ ...base, license: 'SIL Open Font License' });
    expect(info).toMatchObject({
      kind: 'ofl',
      conversionBlocked: false,
      subsettingBlocked: false,
      renameRequired: false,
      notices: [],
    });
  });

  it('blocks conversion and subsetting for restricted embedding', () => {
    const info = analyzeLicense({ ...base, license: 'MIT License', fsType: 2 });
    expect(info).toMatchObject({ conversionBlocked: true, subsettingBlocked: true });
    expect(info.notices).toEqual(['restricted']);
  });

  it('blocks only subsetting for the no-subsetting bit', () => {
    const info = analyzeLicense({ ...base, license: 'MIT License', fsType: 0x0100 });
    expect(info).toMatchObject({ conversionBlocked: false, subsettingBlocked: true });
    expect(info.notices).toEqual(['no-subsetting']);
  });

  it('blocks bitmap-only fonts', () => {
    const info = analyzeLicense({ ...base, license: 'MIT License', fsType: 0x0200 });
    expect(info).toMatchObject({ conversionBlocked: true, subsettingBlocked: true });
    expect(info.notices).toEqual(['bitmap-only']);
  });

  it('requires a rename for an OFL font with a Reserved Font Name', () => {
    const info = analyzeLicense({
      ...base,
      copyright: 'Copyright 2010, with Reserved Font Name "Source".',
      license: 'SIL Open Font License',
    });
    expect(info).toMatchObject({ renameRequired: true, reservedFontNames: ['Source'] });
    expect(info.notices).toEqual(['reserved-name']);
  });

  it('ignores a Reserved Font Name outside OFL', () => {
    const info = analyzeLicense({
      ...base,
      license: 'MIT License',
      copyright: 'Reserved Font Name "X"',
    });
    expect(info.renameRequired).toBe(false);
    expect(info.notices).toEqual([]);
  });

  it('gives a non-blocking notice for an unknown or missing license', () => {
    for (const license of ['Custom EULA', null]) {
      const info = analyzeLicense({ ...base, license });
      expect(info.notices).toEqual(['unknown']);
      expect(info.subsettingBlocked).toBe(false);
    }
  });

  it('treats a missing fsType as no restriction', () => {
    const info = analyzeLicense({ ...base, license: 'MIT License', fsType: null });
    expect(info).toMatchObject({ embedding: null, conversionBlocked: false });
  });
});
