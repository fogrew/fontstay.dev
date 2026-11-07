import { describe, expect, it } from 'vitest';
import { analyzeLicense, embeddingLevel, licenseKind, reservedFontNames } from './license';

const base = { copyright: null, trademark: null, license: null, licenseUrl: null, fsType: 0 };

describe('licenseKind', () => {
  it.each([
    ['This Font Software is licensed under the SIL Open Font License, Version 1.1.', null, 'ofl'],
    [null, 'http://scripts.sil.org/OFL', 'ofl'],
    [null, 'https://openfontlicense.org', 'ofl'],
    ['Licensed under the Apache License, Version 2.0', null, 'apache'],
    ['Licensed under the Apache License, Version 1.1', null, 'unknown'],
    [null, 'https://www.apache.org/licenses/LICENSE-1.1', 'unknown'],
    ['SIL Open Font License, Version 1.0', null, 'unknown'],
    [null, 'https://scripts.sil.org/OFL10', 'unknown'],
    ['OFL-1.0', null, 'unknown'],
    [null, 'https://spdx.org/licenses/OFL-1.0', 'unknown'],
    [null, 'https://spdx.org/licenses/OFL-1.1', 'ofl'],
    [null, 'https://attacker.example/?next=https://opensource.org/licenses/MIT', 'unknown'],
    ['MIT License and SIL Open Font License', null, 'unknown'],
    ['SIL Open Font License, Version 1.1', 'https://opensource.org/licenses/MIT', 'unknown'],
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
    expect(reservedFontNames(['Copyright 2020 Acme with no Reserved Font Name.']).present).toBe(
      false,
    );
    expect(
      reservedFontNames(['"Reserved Font Name" refers to any names specified as such.']).present,
    ).toBe(false);
    expect(reservedFontNames(["with Reserved Font Name 'Source Sans 3.0'. More text."])).toEqual({
      present: true,
      names: ['Source Sans 3.0'],
    });
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
    expect(info).toMatchObject({
      conversionBlocked: true,
      subsettingBlocked: true,
      conversionBlockReason: 'restricted',
      subsettingBlockReason: 'restricted',
    });
    expect(info.notices).toEqual(['restricted']);
  });

  it('blocks only subsetting for the no-subsetting bit', () => {
    const info = analyzeLicense({ ...base, license: 'MIT License', fsType: 0x0100 });
    expect(info).toMatchObject({
      conversionBlocked: false,
      subsettingBlocked: true,
      conversionBlockReason: null,
      subsettingBlockReason: 'no-subsetting',
    });
    expect(info.notices).toEqual(['no-subsetting']);
  });

  it('blocks bitmap-only fonts', () => {
    const info = analyzeLicense({ ...base, license: 'MIT License', fsType: 0x0200 });
    expect(info).toMatchObject({
      conversionBlocked: true,
      subsettingBlocked: true,
      conversionBlockReason: 'bitmap-only',
      subsettingBlockReason: 'bitmap-only',
    });
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

  it('returns bounded name-table metadata for a later LICENSE file', () => {
    const info = analyzeLicense({
      ...base,
      copyright: `Copyright \u001b[31m${'x'.repeat(4000)}`,
      license: `MIT License ${'y'.repeat(4000)}`,
      licenseUrl: 'https://opensource.org/licenses/MIT',
    });
    expect(info.licenseFile?.copyright).toBe(`Copyright [31m${'x'.repeat(1985)}`);
    expect(info.licenseFile?.licenseDescription).toBe(`MIT License ${'y'.repeat(1988)}`);
    expect(info.licenseFile?.licenseText).toContain('Permission is hereby granted');
    expect(info.licenseFile?.licenseUrl).toBe('https://opensource.org/licenses/MIT');
    expect(analyzeLicense({ ...base, license: 'Custom EULA' }).licenseFile).toBeNull();
  });

  it('supplies full standard text for URL-only recognition in every supported license', () => {
    for (const [url, heading] of [
      ['https://scripts.sil.org/OFL', 'SIL OPEN FONT LICENSE'],
      ['https://www.apache.org/licenses/LICENSE-2.0', 'Apache License'],
      ['https://opensource.org/licenses/MIT', 'MIT License'],
      ['https://ubuntu.com/legal/font-licence', 'UBUNTU FONT LICENCE'],
      ['https://creativecommons.org/publicdomain/zero/1.0/', 'CC0 1.0 Universal'],
    ] as const) {
      const info = analyzeLicense({ ...base, licenseUrl: url });
      expect(info.licenseFile?.licenseText).toContain(heading);
      expect(info.licenseFile?.licenseText.length).toBeGreaterThan(500);
    }
  });

  it('bounds direct string inputs before matching reserved names', () => {
    const longPrefix = 'x'.repeat(2000);
    expect(reservedFontNames([`${longPrefix} Reserved Font Name "Hidden"`])).toEqual({
      present: false,
      names: [],
    });
    expect(licenseKind(`${longPrefix} MIT License`, null)).toBe('unknown');
  });
});
