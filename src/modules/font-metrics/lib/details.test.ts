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
