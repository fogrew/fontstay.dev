import { create } from 'fontkitten';

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

const tagOf = (bytes: Uint8Array) => String.fromCharCode(...bytes.subarray(0, 4));

export function sfntOf(data: ArrayBuffer | Uint8Array): Uint8Array | null {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const container = tagOf(bytes);
  if (container !== 'wOFF' && container !== 'wOF2') return bytes;
  const font = create(bytes as Parameters<typeof create>[0]) as unknown as Internal;
  const entries = Object.values(font.directory.tables);
  const head = font.directory.tables.head;
  if (!head) return null;
  try {
    font._decodeTable(head);
  } catch {
    return null;
  }
  const tables: { tag: string; data: Uint8Array }[] = [];
  for (const entry of entries) {
    if (OUTLINE_TABLES.has(entry.tag)) continue;
    if (entry.transformed) return null;
    const stream = font._getTableStream(entry.tag);
    if (!stream) return null;
    tables.push({
      tag: entry.tag,
      data: stream.buffer.slice(stream.pos, stream.pos + entry.length),
    });
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
