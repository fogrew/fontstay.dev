import { readFileSync } from 'node:fs';
import type { Font } from 'fontkitten';
import { describe, expect, it } from 'vitest';
import { readFontDetails } from './details';
import { parseFontBuffer } from './parse';

const load = (name: string) => {
  const bytes = readFileSync(new URL(`../../../../tests/fixtures/fonts/${name}`, import.meta.url));
  return parseFontBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
};

describe('font details', () => {
  it('lists the layout features with their tables', () => {
    const { details } = load('FiraSans-Regular.ttf');
    const tags = details.features.map((feature) => feature.tag);
    expect(tags).toEqual(expect.arrayContaining(['liga', 'kern', 'smcp', 'onum', 'ss01']));
    expect(new Set(tags).size).toBe(tags.length);
    expect(details.features.find((feature) => feature.tag === 'liga')?.tables).toEqual(['GSUB']);
    expect(details.scripts).toEqual(expect.arrayContaining(['latn', 'cyrl', 'grek']));
  });

  it('lists the variable axes and named instances', () => {
    const { details } = load('Mada-VF.ttf');
    expect(details.axes).toEqual([
      { tag: 'wght', name: 'Weight', min: 100, default: 520, max: 1000 },
    ]);
    expect(details.instances.map((instance) => instance.name)).toEqual([
      'Light',
      'Regular',
      'SemiBold',
      'Bold',
      'Black',
    ]);
    expect(details.instances[0]?.coordinates).toEqual({ wght: 100 });
  });

  it('reads the name table', () => {
    const { names } = load('SourceSansPro-Regular.woff2').details;
    expect(names.designer).toBe('Paul D. Hunt');
    expect(names.manufacturer).toBe('Adobe Systems Incorporated');
    expect(names.licenseUrl).toBe('http://scripts.sil.org/OFL');
  });

  it('is identical across containers', () => {
    const { features, scripts } = load('SourceSansPro-Regular.otf').details;
    for (const name of ['SourceSansPro-Regular.woff', 'SourceSansPro-Regular.woff2']) {
      const details = load(name).details;
      expect(details.features).toEqual(features);
      expect(details.scripts).toEqual(scripts);
    }
  });

  it('reports no axes, palettes or colour formats for a plain font', () => {
    const { details } = load('FiraSans-Regular.ttf');
    expect(details.axes).toEqual([]);
    expect(details.palettes).toBeNull();
    expect(details.colorFormats).toEqual([]);
  });
});

function stub(tables: Record<string, Uint8Array>, extra: object = {}): Font {
  return {
    directory: {
      tables: Object.fromEntries(
        Object.entries(tables).map(([tag, data]) => [tag, { length: data.length }]),
      ),
    },
    _getTableStream: (tag: string) => ({ pos: 0, buffer: tables[tag] }),
    ...extra,
  } as unknown as Font;
}

describe('hostile layout tables', () => {
  it('drops a table whose offsets point outside it', () => {
    const forged = new Uint8Array(12);
    new DataView(forged.buffer).setUint16(6, 0xfff0);
    expect(readFontDetails(stub({ GSUB: forged })).features).toEqual([]);
  });

  it('keeps the features read before a truncated record', () => {
    const bytes = new Uint8Array(10 + 2 + 12);
    const view = new DataView(bytes.buffer);
    view.setUint16(6, 10);
    view.setUint16(10, 3);
    bytes.set(
      [...'liga'].map((char) => char.charCodeAt(0)),
      12,
    );
    bytes.set(
      [...'kern'].map((char) => char.charCodeAt(0)),
      18,
    );
    const details = readFontDetails(stub({ GPOS: bytes }));
    expect(details.features.map((feature) => feature.tag)).toEqual(['kern', 'liga']);
  });

  it('skips tags that are not printable ASCII', () => {
    const bytes = new Uint8Array(10 + 2 + 6);
    const view = new DataView(bytes.buffer);
    view.setUint16(6, 10);
    view.setUint16(10, 1);
    bytes.set([1, 2, 3, 4], 12);
    expect(readFontDetails(stub({ GSUB: bytes })).features).toEqual([]);
  });
});

describe('colour palettes', () => {
  it('formats the colours of each palette', () => {
    const CPAL = {
      numPaletteEntries: 2,
      numPalettes: 2,
      colorRecords: [
        { red: 255, green: 0, blue: 0, alpha: 255 },
        { red: 0, green: 128, blue: 255, alpha: 128 },
        { red: 1, green: 2, blue: 3, alpha: 255 },
        { red: 4, green: 5, blue: 6, alpha: 255 },
      ],
      colorRecordIndices: [0, 2],
    };
    const details = readFontDetails(
      stub({ COLR: new Uint8Array(1), CPAL: new Uint8Array(1) }, { CPAL }),
    );
    expect(details.palettes).toEqual({
      entries: 2,
      palettes: [
        ['#ff0000', '#0080ff80'],
        ['#010203', '#040506'],
      ],
    });
    expect(details.colorFormats).toEqual(['COLR']);
  });

  it('ignores a palette that points past the colour records', () => {
    const CPAL = {
      numPaletteEntries: 4,
      numPalettes: 1,
      colorRecords: [],
      colorRecordIndices: [9],
    };
    expect(readFontDetails(stub({}, { CPAL })).palettes).toBeNull();
  });
});

describe('hostile tags and strings', () => {
  const axis = (axisTag: string, minValue = 0, defaultValue = 1, maxValue = 2) => ({
    axisTag,
    name: { en: axisTag },
    minValue,
    defaultValue,
    maxValue,
  });

  it('rejects feature tags that are not alphanumeric', () => {
    const bytes = new Uint8Array(10 + 2 + 18);
    const view = new DataView(bytes.buffer);
    view.setUint16(6, 10);
    view.setUint16(10, 3);
    for (const [at, tag] of [
      [12, 'a"}b'],
      [18, 'ab  '],
      [24, 'ss01'],
    ] as const) {
      bytes.set(
        [...tag].map((char) => char.charCodeAt(0)),
        at,
      );
    }
    expect(readFontDetails(stub({ GSUB: bytes })).features.map((feature) => feature.tag)).toEqual([
      'ss01',
    ]);
  });

  it('keeps the scripts when the feature list is malformed', () => {
    const bytes = new Uint8Array(40);
    const view = new DataView(bytes.buffer);
    view.setUint16(4, 10);
    view.setUint16(6, 0xfff0);
    view.setUint16(10, 1);
    bytes.set(
      [...'latn'].map((char) => char.charCodeAt(0)),
      12,
    );
    expect(readFontDetails(stub({ GSUB: bytes })).scripts).toEqual(['latn']);
  });

  it('drops malformed, duplicate and inverted axes and keeps the coordinates aligned', () => {
    const fvar = {
      axis: [
        axis('w"}x'),
        axis('wght', 100, 400, 900),
        axis('wght'),
        axis('wdth', 90, 80, 100),
        axis('opsz'),
      ],
      instance: [{ name: { en: 'Bold' }, coord: [1, 700, 5, 6, 12] }],
    };
    const details = readFontDetails(stub({}, { fvar }));
    expect(details.axes.map((item) => item.tag)).toEqual(['wght', 'opsz']);
    expect(details.instances).toEqual([{ name: 'Bold', coordinates: { wght: 700, opsz: 12 } }]);
  });

  it('strips control and bidi characters from names', () => {
    const records = { designer: { en: 'Ann‮e\u0007 Lee' }, license: { en: 'One\r\nTwo​' } };
    const { names } = readFontDetails(stub({}, { name: { records } }));
    expect(names.designer).toBe('Anne Lee');
    expect(names.license).toBe('One\nTwo');
  });
});

describe('embedding permissions', () => {
  it('reads the OS/2 fsType and the trademark notice', () => {
    const os2 = new Uint8Array(78);
    new DataView(os2.buffer).setUint16(8, 0x0102);
    const details = readFontDetails(
      stub({ 'OS/2': os2 }, { name: { records: { trademark: { en: 'Acme is a trademark' } } } }),
    );
    expect(details.fsType).toBe(0x0102);
    expect(details.names.trademark).toBe('Acme is a trademark');
  });

  it('reports no fsType for a missing or truncated OS/2 table', () => {
    expect(readFontDetails(stub({})).fsType).toBeNull();
    expect(readFontDetails(stub({ 'OS/2': new Uint8Array(6) })).fsType).toBeNull();
  });

  it('reads an installable fsType from a real font', () => {
    expect(load('SourceSansPro-Regular.woff2').details.fsType).toBe(0);
  });
});
