export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

export const MAX_ZIP_ENTRIES = 1000;
export const MAX_ZIP_BYTES = 256 * 1024 * 1024;

const encoder = new TextEncoder();
const DOS_TIME = 0;
const DOS_DATE = (1 << 5) | 1;
const UTF8_FLAG = 0x0800;
const VERSION = 20;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = (CRC_TABLE[(crc ^ (data[i] as number)) & 0xff] as number) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function isSafeZipName(name: string): boolean {
  if (name.length === 0 || encoder.encode(name).length > 255) return false;
  if (!name.isWellFormed() || name.startsWith('/') || name.endsWith('/')) return false;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejects control characters in names.
  if (/[\\\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩:*?"<>|]/.test(name)) return false;
  return name.split('/').every((part) => part !== '' && !/[. ]$/.test(part));
}

export class ZipError extends Error {
  constructor(readonly code: 'bad-name' | 'duplicate' | 'too-many' | 'too-large') {
    super(code);
    this.name = 'ZipError';
  }
}

function collides(seen: ReadonlySet<string>, key: string): boolean {
  for (const other of seen)
    if (other.startsWith(`${key}/`) || key.startsWith(`${other}/`)) return true;
  return false;
}

function header(size: number, write: (view: DataView) => void): Uint8Array {
  const bytes = new Uint8Array(size);
  write(new DataView(bytes.buffer));
  return bytes;
}

/** Builds a store-only archive: font files are already compressed. */
export function createZip(entries: readonly ZipEntry[]): Uint8Array {
  if (entries.length > MAX_ZIP_ENTRIES) throw new ZipError('too-many');
  const seen = new Set<string>();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const { name, data } of entries) {
    if (!isSafeZipName(name)) throw new ZipError('bad-name');
    const key = name.normalize('NFC').toLowerCase();
    if (seen.has(key) || collides(seen, key)) throw new ZipError('duplicate');
    seen.add(key);
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);
    const local = header(30, (view) => {
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, VERSION, true);
      view.setUint16(6, UTF8_FLAG, true);
      view.setUint16(10, DOS_TIME, true);
      view.setUint16(12, DOS_DATE, true);
      view.setUint32(14, crc, true);
      view.setUint32(18, data.length, true);
      view.setUint32(22, data.length, true);
      view.setUint16(26, nameBytes.length, true);
    });
    central.push(
      header(46, (view) => {
        view.setUint32(0, 0x02014b50, true);
        view.setUint16(4, VERSION, true);
        view.setUint16(6, VERSION, true);
        view.setUint16(8, UTF8_FLAG, true);
        view.setUint16(12, DOS_TIME, true);
        view.setUint16(14, DOS_DATE, true);
        view.setUint32(16, crc, true);
        view.setUint32(20, data.length, true);
        view.setUint32(24, data.length, true);
        view.setUint16(28, nameBytes.length, true);
        view.setUint32(42, offset, true);
      }),
      nameBytes,
    );
    parts.push(local, nameBytes, data);
    offset += local.length + nameBytes.length + data.length;
    if (offset > MAX_ZIP_BYTES) throw new ZipError('too-large');
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  if (offset + centralSize > MAX_ZIP_BYTES) throw new ZipError('too-large');
  const end = header(22, (view) => {
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, entries.length, true);
    view.setUint16(10, entries.length, true);
    view.setUint32(12, centralSize, true);
    view.setUint32(16, offset, true);
  });
  const out = new Uint8Array(offset + centralSize + end.length);
  let position = 0;
  for (const part of [...parts, ...central, end]) {
    out.set(part, position);
    position += part.length;
  }
  return out;
}
