import { readFileSync } from 'node:fs';
import { create, type Font } from 'fontkitten';
import { describe, expect, it } from 'vitest';
import { buildFont, buildWoff2 } from './forged.test-util';
import { parseFontBuffer } from './parse';

function fixture(name: string): ArrayBuffer {
  const bytes = readFileSync(new URL(`../../../../tests/fixtures/fonts/${name}`, import.meta.url));
  return Uint8Array.from(bytes).buffer;
}

describe('font metrics extraction', () => {
  it.each(['otf', 'woff', 'woff2'])('reads Source Sans Pro %s metrics', (format) => {
    const metrics = parseFontBuffer(fixture(`SourceSansPro-Regular.${format}`));
    expect(metrics.names.family).toBe('Source Sans Pro');
    expect(metrics.unitsPerEm).toBe(1000);
    expect(metrics.hhea).toEqual({ ascent: 984, descent: -273, lineGap: 0 });
    expect(metrics.typo).toEqual({ ascent: 750, descent: -250, lineGap: 0, useTypoMetrics: false });
    expect(metrics.win).toEqual({ ascent: 984, descent: 273 });
    expect(metrics.capHeight).toBe(660);
    expect(metrics.xHeight).toBe(480);
    expect(metrics.advances[metrics.codePoints.indexOf(65)]).toBe(544);
    expect(metrics.codePoints).toContain(0x410);
    expect(metrics.codePoints).toContain(0x391);
    expect(metrics.codePoints).not.toContain(0xffff);
    expect(metrics.codePoints).toEqual(
      Uint32Array.from([...metrics.codePoints].sort((a, b) => a - b)),
    );
    expect(metrics.advances.length).toBe(metrics.codePoints.length);
    expect(metrics.isVariable).toBe(false);
    expect(metrics.style).toEqual({ weight: 400, italic: false, category: 'sans-serif' });
  });

  it('preserves the USE_TYPO_METRICS flag in a TTF', () => {
    const metrics = parseFontBuffer(fixture('FiraSans-Regular.ttf'));
    expect(metrics.names.family).toBe('Fira Sans');
    expect(metrics.typo).toEqual({ ascent: 935, descent: -265, lineGap: 0, useTypoMetrics: true });
    expect(metrics.advances[metrics.codePoints.indexOf(65)]).toBe(573);
    expect(metrics.codePoints).not.toContain(0xffff);
  });

  it('identifies a variable font and reads its default instance', () => {
    const metrics = parseFontBuffer(fixture('Mada-VF.ttf'));
    expect(metrics.isVariable).toBe(true);
    expect(metrics.advances[metrics.codePoints.indexOf(65)]).toBe(553);
    expect(metrics.hhea.lineGap).toBe(100);
  });

  it.each([
    { version: 0, length: 78 },
    { version: 0, length: 68 },
    { version: 1, length: 86 },
  ])('reads OS/2 version $version with $length bytes', ({ version, length }) => {
    const buffer = fixture('FiraSans-Regular.ttf');
    const view = new DataView(buffer);
    for (let i = 0; i < view.getUint16(4); i++) {
      const record = 12 + i * 16;
      if (view.getUint32(record) === 0x4f532f32) {
        view.setUint16(view.getUint32(record + 8), version);
        view.setUint32(record + 12, length);
        break;
      }
    }
    const metrics = parseFontBuffer(buffer);
    expect(metrics.capHeight).toBeNull();
    expect(metrics.xHeight).toBeNull();
    if (length === 68) {
      expect(metrics.typo).toBeNull();
      expect(metrics.win).toBeNull();
    } else {
      expect(metrics.typo).toEqual({
        ascent: 935,
        descent: -265,
        lineGap: 0,
        useTypoMetrics: false,
      });
      expect(metrics.win).toEqual({ ascent: 935, descent: 265 });
    }
  });

  it.each([
    new ArrayBuffer(0),
    new ArrayBuffer(48),
    fixture('SourceSansPro-Regular.woff2').slice(0, 100),
  ])('rejects invalid or truncated input', (buffer) => {
    expect(() => parseFontBuffer(buffer)).toThrow();
  });

  it('rejects oversized input before parsing', () => {
    expect(() => parseFontBuffer(new ArrayBuffer(10 * 1024 * 1024 + 1))).toThrow('too-large');
  });

  it.each(['woff', 'woff2'])('rejects excessive declared expansion in %s', (format) => {
    const buffer = fixture(`SourceSansPro-Regular.${format}`);
    new DataView(buffer).setUint32(16, 65 * 1024 * 1024);
    expect(() => parseFontBuffer(buffer)).toThrow('too-large');
  });

  it('excludes code points that map to .notdef', () => {
    const metrics = parseFontBuffer(
      buildFont(
        [
          [0x41, 0x42, 1],
          [0x50, 0x51, 0],
        ],
        4,
      ),
    );
    expect(Array.from(metrics.codePoints)).toEqual([0x41, 0x42, 0x51]);
    expect(Array.from(metrics.advances)).toEqual([600, 700, 600]);
  });

  it('rejects a cmap with overlapping groups that expand beyond the code point space', () => {
    const groups = Array.from({ length: 60 }, () => [0, 0x10ffff, 1] as [number, number, number]);
    expect(() => parseFontBuffer(buildFont(groups))).toThrow('too-large');
  });

  it('rejects a cmap with more entries than the extraction limit', () => {
    expect(() => parseFontBuffer(buildFont([[0, 0x30000, 1]]))).toThrow('too-large');
  });

  it('caps the WOFF2 Brotli output at the declared size', () => {
    const buffer = buildWoff2(2048, new Uint8Array(4 * 1024 * 1024));
    expect(() => parseFontBuffer(buffer)).toThrow('too-large');
    const font = create(new Uint8Array(buffer) as Parameters<typeof create>[0]) as Font;
    expect(() => font.unitsPerEm).toThrow();
    expect((font as { _decompressError?: Error })._decompressError?.message).toMatch(
      /^fontkitten-limit:/,
    );
  });

  it('caps cmap range expansion inside the decoder', () => {
    const groups = Array.from({ length: 60 }, () => [0, 0x10ffff, 1] as [number, number, number]);
    const font = create(new Uint8Array(buildFont(groups)) as Parameters<typeof create>[0]) as Font;
    expect(() => font.characterSet).toThrow(/^fontkitten-limit:/);
  });

  it('rejects a cmap declaring more groups than there are code points', () => {
    const groups = Array.from({ length: 0x110001 }, () => [1, 0, 1] as [number, number, number]);
    const font = create(new Uint8Array(buildFont(groups)) as Parameters<typeof create>[0]) as Font;
    expect(() => font.characterSet).toThrow(/^fontkitten-limit:/);
  });

  it('rejects a WOFF2 table directory that declares more than the decoded limit', () => {
    const buffer = buildWoff2(2048, new Uint8Array(2048));
    const view = new DataView(buffer);
    for (const [i, byte] of [0xff, 0xff, 0xff, 0x7f].entries()) view.setUint8(49 + i, byte);
    expect(() => parseFontBuffer(buffer)).toThrow('too-large');
  });
});
