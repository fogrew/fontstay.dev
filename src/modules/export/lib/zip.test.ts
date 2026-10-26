import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { crc32, createZip, isSafeZipName, MAX_ZIP_ENTRIES, ZipError } from './zip';

const hasTar = (() => {
  try {
    return execFileSync('tar', ['--version'], { encoding: 'utf8' }).includes('bsdtar');
  } catch {
    return false;
  }
})();

const bytes = (text: string) => new TextEncoder().encode(text);

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(bytes('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe('isSafeZipName', () => {
  it.each(['a.woff2', 'fonts/Inter/OFL.txt', 'тест.txt'])('accepts %s', (name) => {
    expect(isSafeZipName(name)).toBe(true);
  });
  it.each([
    '',
    '/etc/passwd',
    '../x',
    'a/../b',
    'a//b',
    'a\\b',
    'C:x',
    'dir/',
    'a\u0000b',
    '.',
    'a./x',
    'a /x',
    'a\uD800',
    'a‮b',
    'a*b',
  ])('rejects %j', (name) => {
    expect(isSafeZipName(name)).toBe(false);
  });
});

describe('createZip', () => {
  it('is deterministic and ends with a consistent central directory', () => {
    const entries = [
      { name: 'fonts/a.woff2', data: bytes('alpha') },
      { name: 'LICENSE.txt', data: new Uint8Array() },
    ];
    const zip = createZip(entries);
    expect(createZip(entries)).toEqual(zip);
    const view = new DataView(zip.buffer);
    const end = zip.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    expect(view.getUint32(view.getUint32(end + 16, true), true)).toBe(0x02014b50);
  });

  it.skipIf(!hasTar)('is accepted by the system tar', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zip-'));
    const path = join(dir, 'a.zip');
    const payload = Uint8Array.from({ length: 5000 }, (_, i) => (i * 7) % 256);
    writeFileSync(path, createZip([{ name: 'd/x.bin', data: payload }]));
    execFileSync('tar', ['-xf', path, '-C', dir], { stdio: 'ignore' });
    expect(new Uint8Array(readFileSync(join(dir, 'd', 'x.bin')))).toEqual(payload);
    rmSync(dir, { recursive: true, force: true });
  });

  it('rejects a file that is also a directory and Unicode-equivalent names', () => {
    const data = new Uint8Array();
    expect(() =>
      createZip([
        { name: 'a', data },
        { name: 'a/b', data },
      ]),
    ).toThrow(ZipError);
    expect(() =>
      createZip([
        { name: 'é.txt', data },
        { name: 'é.txt', data },
      ]),
    ).toThrow(ZipError);
  });

  it('enforces the name and entry limits', () => {
    const data = new Uint8Array();
    expect(() => createZip([{ name: 'a'.repeat(255), data }])).not.toThrow();
    expect(() => createZip([{ name: 'a'.repeat(256), data }])).toThrow(ZipError);
    expect(() => createZip([{ name: 'é'.repeat(128), data }])).toThrow(ZipError);
    const many = Array.from({ length: MAX_ZIP_ENTRIES + 1 }, (_, i) => ({ name: `f${i}`, data }));
    expect(() => createZip(many)).toThrow(ZipError);
  });

  it('records names, sizes and offsets in the central directory', () => {
    const entries = [
      { name: 'one.bin', data: bytes('12345') },
      { name: 'тест.txt', data: bytes('abc') },
    ];
    const zip = createZip(entries);
    const view = new DataView(zip.buffer);
    const end = zip.length - 22;
    let cursor = view.getUint32(end + 16, true);
    let local = 0;
    for (const { name, data } of entries) {
      expect(view.getUint32(cursor, true)).toBe(0x02014b50);
      expect(view.getUint16(cursor + 8, true) & 0x0800).toBe(0x0800);
      expect(view.getUint32(cursor + 16, true)).toBe(crc32(data));
      expect(view.getUint32(cursor + 20, true)).toBe(data.length);
      expect(view.getUint32(cursor + 42, true)).toBe(local);
      const nameLength = view.getUint16(cursor + 28, true);
      expect(new TextDecoder().decode(zip.slice(cursor + 46, cursor + 46 + nameLength))).toBe(name);
      cursor += 46 + nameLength;
      local += 30 + new TextEncoder().encode(name).length + data.length;
    }
    expect(cursor).toBe(end);
    expect(view.getUint32(end + 12, true)).toBe(end - view.getUint32(end + 16, true));
  });

  it('rejects unsafe and duplicate names', () => {
    const data = new Uint8Array();
    expect(() => createZip([{ name: '../x', data }])).toThrow(ZipError);
    expect(() =>
      createZip([
        { name: 'A.txt', data },
        { name: 'a.txt', data },
      ]),
    ).toThrow(ZipError);
  });

  it('keeps every payload at the offset its header declares', () => {
    fc.assert(
      fc.property(fc.array(fc.uint8Array({ maxLength: 64 }), { maxLength: 8 }), (payloads) => {
        const zip = createZip(payloads.map((data, i) => ({ name: `f${i}.bin`, data })));
        const view = new DataView(zip.buffer);
        let cursor = 0;
        for (const data of payloads) {
          expect(view.getUint32(cursor, true)).toBe(0x04034b50);
          const size = view.getUint32(cursor + 18, true);
          const nameLength = view.getUint16(cursor + 26, true);
          const start = cursor + 30 + nameLength;
          expect(zip.slice(start, start + size)).toEqual(data);
          expect(view.getUint32(cursor + 14, true)).toBe(crc32(data));
          cursor = start + size;
        }
      }),
    );
  });
});
