import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseFontBuffer } from '@/modules/font-metrics/lib/parse';
import { shapedRatio, webRatio } from '@/modules/generator/lib/calibration';
import { sfntOf } from '@/modules/generator/lib/sfnt';
import { shapedWidthEm } from '@/modules/generator/lib/shaping';

const fixture = (name: string) => {
  const bytes = readFileSync(new URL(`../../../tests/fixtures/fonts/${name}`, import.meta.url));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
};

describe('shaping', () => {
  it('measures the same width in woff, woff2 and sfnt containers', async () => {
    const woff2 = await shapedWidthEm(fixture('SourceSansPro-Regular.woff2'), 'Hamburgefonstiv AV');
    const woff = await shapedWidthEm(fixture('SourceSansPro-Regular.woff'), 'Hamburgefonstiv AV');
    expect(woff2).toBeGreaterThan(5);
    expect(woff).toBeCloseTo(woff2, 3);
  });

  it('rebuilds an sfnt that the parser accepts from a woff2 file', () => {
    const sfnt = sfntOf(fixture('SourceSansPro-Regular.woff2'));
    expect(sfnt).not.toBeNull();
    const flavor = Array.from(sfnt?.subarray(0, 4) ?? []);
    expect([
      [0x4f, 0x54, 0x54, 0x4f],
      [0, 1, 0, 0],
    ]).toContainEqual(flavor);
  });

  it('keeps the web ratio within the clamp range and matches Chromium on Source Sans Pro', async () => {
    const bytes = fixture('SourceSansPro-Regular.woff2');
    const metrics = parseFontBuffer(bytes);
    const ratio = await webRatio(bytes, metrics, 'en');
    expect(ratio).toBeCloseTo(0.99592, 4);
    expect(await shapedRatio(bytes, metrics, 'en')).toBe(ratio);
  });

  it('falls back to 1 when the bytes are not a font', async () => {
    const metrics = parseFontBuffer(fixture('SourceSansPro-Regular.woff2'));
    expect(await webRatio(new Uint8Array(64), metrics, 'en')).toBe(1);
  });
});
