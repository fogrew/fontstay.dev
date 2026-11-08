import { create } from 'fontkitten';
import { rebuildGlyf } from './woff2-glyf';

interface TableEntry {
  tag: string;
  length: number;
  transformed?: boolean;
}

interface Stream {
  buffer: Uint8Array;
  pos: number;
}

interface Internal {
  directory: { tables: Record<string, TableEntry> };
  _decodeTable(table: TableEntry): unknown;
  _getTableStream(tag: string): Stream | null;
}

const OUTLINE_TABLES = new Set(['glyf', 'loca']);
const HEAD_LOCA_FORMAT_AT = 50;
const MAX_TABLE = 64 * 1024 * 1024;
const MAX_DECLARED = 256 * 1024 * 1024;

interface TransformedEntry extends TableEntry {
  transformLength?: number;
}

function metricsOf(
  data: Uint8Array,
  maxp: Uint8Array,
  hhea: Uint8Array,
  xMin: Int16Array,
): Uint8Array | null {
  if (maxp.length < 6 || hhea.length < 36 || data.length < 1) return null;
  const numGlyphs = new DataView(maxp.buffer, maxp.byteOffset, maxp.byteLength).getUint16(4);
  const numHMetrics = new DataView(hhea.buffer, hhea.byteOffset, hhea.byteLength).getUint16(34);
  if (numHMetrics > numGlyphs || numGlyphs > xMin.length) return null;
  const flags = data[0] ?? 0;
  const lsbOmitted = (flags & 1) !== 0;
  const bearingOmitted = (flags & 2) !== 0;
  const input = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let at = 1;
  const advances = at;
  at += 2 * numHMetrics;
  const lsbs = at;
  if (!lsbOmitted) at += 2 * numHMetrics;
  const bearings = at;
  if (!bearingOmitted) at += 2 * (numGlyphs - numHMetrics);
  if (at > data.length) return null;
  const out = new Uint8Array(4 * numHMetrics + 2 * (numGlyphs - numHMetrics));
  const view = new DataView(out.buffer);
  for (let glyph = 0; glyph < numHMetrics; glyph++) {
    view.setUint16(4 * glyph, input.getUint16(advances + 2 * glyph));
    view.setInt16(
      4 * glyph + 2,
      lsbOmitted ? (xMin[glyph] ?? 0) : input.getInt16(lsbs + 2 * glyph),
    );
  }
  for (let glyph = numHMetrics; glyph < numGlyphs; glyph++) {
    view.setInt16(
      4 * numHMetrics + 2 * (glyph - numHMetrics),
      bearingOmitted ? (xMin[glyph] ?? 0) : input.getInt16(bearings + 2 * (glyph - numHMetrics)),
    );
  }
  return out;
}

const tagOf = (bytes: Uint8Array) => String.fromCharCode(...bytes.subarray(0, 4));

export function sfntOf(data: ArrayBuffer | Uint8Array): Uint8Array | null {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const container = tagOf(bytes);
  if (container !== 'wOFF' && container !== 'wOF2') return bytes;
  const font = create(bytes as Parameters<typeof create>[0]) as unknown as Internal;
  const entries = Object.values(font.directory.tables);
  const declared = entries.reduce(
    (sum, entry) => sum + ((entry as TransformedEntry).transformLength ?? entry.length),
    0,
  );
  if (declared > MAX_DECLARED) return null;
  const head = font.directory.tables.head;
  if (!head) return null;
  try {
    font._decodeTable(head);
  } catch {
    return null;
  }
  const present = font.directory.tables;
  const needsOutlines = !!present.fvar && !!present.gvar && !present.HVAR;
  const tables: { tag: string; data: Uint8Array }[] = [];
  const rawOf = (entry: TableEntry) => {
    const stream = font._getTableStream(entry.tag);
    if (!stream) return null;
    const length = entry.transformed
      ? ((entry as TransformedEntry).transformLength ?? 0)
      : entry.length;
    if (length > MAX_TABLE) return null;
    return stream.buffer.slice(stream.pos, stream.pos + length);
  };
  let rebuilt: ReturnType<typeof rebuildGlyf> | undefined;
  const glyf = present.glyf;
  const hmtx = present.hmtx;
  if (glyf?.transformed && (needsOutlines || hmtx?.transformed)) {
    const data = rawOf(glyf);
    if (!data) return null;
    try {
      rebuilt = rebuildGlyf(data);
    } catch {
      return null;
    }
    const maxp = present.maxp && rawOf(present.maxp);
    if (
      !maxp ||
      maxp.length < 6 ||
      new DataView(maxp.buffer, maxp.byteOffset, maxp.byteLength).getUint16(4) !==
        rebuilt.xMin.length
    ) {
      return null;
    }
  }
  for (const entry of entries) {
    if (OUTLINE_TABLES.has(entry.tag)) {
      if (!needsOutlines) continue;
      if (entry.transformed) {
        if (!rebuilt) return null;
        tables.push({ tag: entry.tag, data: entry.tag === 'glyf' ? rebuilt.glyf : rebuilt.loca });
        continue;
      }
    } else if (entry.transformed) {
      if (entry.tag !== 'hmtx' || !rebuilt) return null;
      const data = rawOf(entry);
      const maxp = present.maxp && rawOf(present.maxp);
      const hhea = present.hhea && rawOf(present.hhea);
      if (!data || !maxp || !hhea) return null;
      const metrics = metricsOf(data, maxp, hhea, rebuilt.xMin);
      if (!metrics) return null;
      tables.push({ tag: 'hmtx', data: metrics });
      continue;
    }
    const data = rawOf(entry);
    if (!data) return null;
    tables.push({ tag: entry.tag, data });
  }
  if (rebuilt && needsOutlines) {
    const headTable = tables.find((table) => table.tag === 'head');
    if (!headTable || headTable.data.length < HEAD_LOCA_FORMAT_AT + 2) return null;
    headTable.data = headTable.data.slice();
    new DataView(
      headTable.data.buffer,
      headTable.data.byteOffset,
      headTable.data.byteLength,
    ).setInt16(HEAD_LOCA_FORMAT_AT, 1);
  }
  tables.sort((a, b) => (a.tag < b.tag ? -1 : 1));
  const headerSize = 12 + 16 * tables.length;
  const padded = (length: number) => (length + 3) & ~3;
  const total = tables.reduce((sum, table) => sum + padded(table.data.length), headerSize);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  out.set(bytes.subarray(4, 8), 0);
  const exponent = Math.floor(Math.log2(Math.max(1, tables.length)));
  view.setUint16(4, tables.length);
  view.setUint16(6, 16 * 2 ** exponent);
  view.setUint16(8, exponent);
  view.setUint16(10, 16 * tables.length - 16 * 2 ** exponent);
  let offset = headerSize;
  for (const [index, table] of tables.entries()) {
    const record = 12 + 16 * index;
    for (let at = 0; at < 4; at++) out[record + at] = table.tag.charCodeAt(at);
    view.setUint32(record + 8, offset);
    view.setUint32(record + 12, table.data.length);
    out.set(table.data, offset);
    offset += padded(table.data.length);
  }
  return out;
}
