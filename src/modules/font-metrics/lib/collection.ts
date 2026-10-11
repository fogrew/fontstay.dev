import { FontParseError, MAX_DECODED_BYTES, MAX_FONT_BYTES, MAX_TABLES } from './model';

export const MAX_COLLECTION_MEMBERS = 32;

const TTC_TAG = 0x74746366;
const HEADER_BYTES = 12;
const TABLE_RECORD_BYTES = 16;

export function isFontCollection(buffer: ArrayBuffer): boolean {
  return buffer.byteLength >= HEADER_BYTES && new DataView(buffer).getUint32(0) === TTC_TAG;
}

export function collectionSize(buffer: ArrayBuffer): number {
  if (!isFontCollection(buffer) || buffer.byteLength > MAX_FONT_BYTES) {
    throw new FontParseError('invalid-font');
  }
  const view = new DataView(buffer);
  const version = view.getUint16(4);
  const count = view.getUint32(8);
  if (version < 1 || version > 2 || count === 0 || count > MAX_COLLECTION_MEMBERS) {
    throw new FontParseError('invalid-font');
  }
  if (HEADER_BYTES + count * 4 > buffer.byteLength) throw new FontParseError('invalid-font');
  return count;
}

export function extractCollectionMember(buffer: ArrayBuffer, index: number): ArrayBuffer {
  const count = collectionSize(buffer);
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new FontParseError('invalid-font');
  }
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const start = view.getUint32(HEADER_BYTES + index * 4);
  if (start + HEADER_BYTES > buffer.byteLength) throw new FontParseError('invalid-font');
  const tableCount = view.getUint16(start + 4);
  if (tableCount === 0 || tableCount > MAX_TABLES) throw new FontParseError('invalid-font');
  const recordsEnd = start + HEADER_BYTES + tableCount * TABLE_RECORD_BYTES;
  if (recordsEnd > buffer.byteLength) throw new FontParseError('invalid-font');

  const headerSize = HEADER_BYTES + tableCount * TABLE_RECORD_BYTES;
  const tables: { from: number; length: number }[] = [];
  let total = headerSize;
  for (let table = 0; table < tableCount; table++) {
    const record = start + HEADER_BYTES + table * TABLE_RECORD_BYTES;
    const from = view.getUint32(record + 8);
    const length = view.getUint32(record + 12);
    if (from + length > buffer.byteLength) throw new FontParseError('invalid-font');
    total += Math.ceil(length / 4) * 4;
    if (total > MAX_DECODED_BYTES) throw new FontParseError('too-large');
    tables.push({ from, length });
  }
  if (total > MAX_FONT_BYTES) throw new FontParseError('too-large');

  const result = new Uint8Array(total);
  const out = new DataView(result.buffer);
  result.set(bytes.subarray(start, start + HEADER_BYTES));
  let offset = headerSize;
  for (const [table, { from, length }] of tables.entries()) {
    const record = start + HEADER_BYTES + table * TABLE_RECORD_BYTES;
    const target = HEADER_BYTES + table * TABLE_RECORD_BYTES;
    result.set(bytes.subarray(record, record + 8), target);
    out.setUint32(target + 8, offset);
    out.setUint32(target + 12, length);
    result.set(bytes.subarray(from, from + length), offset);
    offset += Math.ceil(length / 4) * 4;
  }
  return result.buffer;
}
