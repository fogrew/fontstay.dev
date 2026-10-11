import { brotliCompressSync, constants } from 'node:zlib';

type Group = [start: number, end: number, glyph: number];

function table(size: number, write: (view: DataView) => void): Uint8Array {
  const bytes = new Uint8Array(size);
  write(new DataView(bytes.buffer));
  return bytes;
}

function tag(name: string): number {
  return new DataView(new TextEncoder().encode(name).buffer).getUint32(0);
}

export function buildSfnt(tables: Record<string, Uint8Array>): ArrayBuffer {
  const entries = Object.entries(tables).sort(([a], [b]) => (a < b ? -1 : 1));
  const padded = (data: Uint8Array) => Math.ceil(data.length / 4) * 4;
  const dataStart = 12 + entries.length * 16;
  const total = entries.reduce((sum, [, data]) => sum + padded(data), dataStart);
  const bytes = new Uint8Array(total);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x00010000);
  view.setUint16(4, entries.length);
  let offset = dataStart;
  for (const [i, [name, data]] of entries.entries()) {
    const record = 12 + i * 16;
    view.setUint32(record, tag(name));
    view.setUint32(record + 8, offset);
    view.setUint32(record + 12, data.length);
    bytes.set(data, offset);
    offset += padded(data);
  }
  return bytes.buffer;
}

export function buildCmap12(groups: Group[]): Uint8Array {
  const length = 16 + groups.length * 12;
  return table(12 + length, (view) => {
    view.setUint16(2, 1);
    view.setUint16(4, 3);
    view.setUint16(6, 10);
    view.setUint32(8, 12);
    view.setUint16(12, 12);
    view.setUint32(16, length);
    view.setUint32(24, groups.length);
    groups.forEach(([start, end, glyph], i) => {
      view.setUint32(28 + i * 12, start);
      view.setUint32(32 + i * 12, end);
      view.setUint32(36 + i * 12, glyph);
    });
  });
}

export function buildFont(cmapGroups: Group[], glyphCount = 3): ArrayBuffer {
  return buildSfnt({
    cmap: buildCmap12(cmapGroups),
    head: table(54, (view) => view.setUint16(18, 1000)),
    hhea: table(36, (view) => view.setUint16(34, glyphCount)),
    maxp: table(32, (view) => {
      view.setUint32(0, 0x00010000);
      view.setUint16(4, glyphCount);
    }),
    hmtx: table(glyphCount * 4, (view) => {
      for (let i = 0; i < glyphCount; i++) view.setUint16(i * 4, 500 + i * 100);
    }),
    'OS/2': new Uint8Array(78),
    loca: table((glyphCount + 1) * 2, () => {}),
    glyf: new Uint8Array(4),
  });
}

export function buildWoff2(declaredBytes: number, payload: Uint8Array): ArrayBuffer {
  const compressed = brotliCompressSync(payload, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 1 },
  });
  const base128 = [0x80 | (declaredBytes >> 7), declaredBytes & 0x7f];
  const directory = [1, ...base128];
  const length = 48 + directory.length + compressed.length;
  const bytes = new Uint8Array(length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x774f4632);
  view.setUint32(4, 0x00010000);
  view.setUint32(8, length);
  view.setUint16(12, 1);
  view.setUint32(16, declaredBytes);
  view.setUint32(20, compressed.length);
  bytes.set(directory, 48);
  bytes.set(compressed, 48 + directory.length);
  return bytes.buffer;
}

export function buildCollection(fonts: ArrayBuffer[]): ArrayBuffer {
  const headerSize = 12 + fonts.length * 4;
  const total = fonts.reduce((sum, font) => sum + font.byteLength, headerSize);
  const bytes = new Uint8Array(total);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x74746366);
  view.setUint16(4, 1);
  view.setUint32(8, fonts.length);
  let start = headerSize;
  for (const [index, font] of fonts.entries()) {
    view.setUint32(12 + index * 4, start);
    bytes.set(new Uint8Array(font), start);
    const tableCount = view.getUint16(start + 4);
    for (let table = 0; table < tableCount; table++) {
      const record = start + 12 + table * 16 + 8;
      view.setUint32(record, view.getUint32(record) + start);
    }
    start += font.byteLength;
  }
  return bytes.buffer;
}
