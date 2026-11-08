import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { measureWebRatio } from './calibration';
import { font } from './font.test-util';
import { rebuildGlyf, Woff2GlyfError } from './woff2-glyf';

const header = (numGlyphs: number, sizes: number[]) => {
  const out = new Uint8Array(36);
  const view = new DataView(out.buffer);
  view.setUint16(4, numGlyphs);
  for (const [index, size] of sizes.entries()) view.setUint32(8 + 4 * index, size);
  return out;
};

describe('rebuildGlyf', () => {
  it('rebuilds an empty table', () => {
    const rebuilt = rebuildGlyf(header(0, [0, 0, 0, 0, 0, 0, 0]));
    expect(rebuilt.glyf.length).toBe(0);
    expect(rebuilt.loca.length).toBe(4);
  });

  it('rejects declared stream sizes beyond the table', () => {
    expect(() => rebuildGlyf(header(1, [0, 0, 0, 0, 0, 0, 0xffffffff]))).toThrow(Woff2GlyfError);
  });

  it('rejects a contour without points', () => {
    const table = new Uint8Array([...header(1, [2, 1, 0, 0, 0, 4, 0]), 0, 1, 0, 0, 0, 0, 0]);
    expect(() => rebuildGlyf(table)).toThrow('Contour without points');
  });

  it('rejects an empty glyph that has a box', () => {
    const table = new Uint8Array([...header(1, [2, 0, 0, 0, 0, 4, 0]), 0, 0, 0x80, 0, 0, 0]);
    expect(() => rebuildGlyf(table)).toThrow('Empty glyph with a box');
  });

  it('only throws Woff2GlyfError on arbitrary bytes', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 300 }), (bytes) => {
        try {
          rebuildGlyf(bytes);
        } catch (thrown) {
          expect(thrown).toBeInstanceOf(Woff2GlyfError);
        }
      }),
    );
  });

  it('only throws Woff2GlyfError on well-framed tables with random streams', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 0, maxLength: 200 }),
        fc.integer({ min: 0, max: 40 }),
        (body, numGlyphs) => {
          const framed = new Uint8Array(36 + body.length);
          framed.set(header(numGlyphs, [body.length, 0, 0, 0, 0, 0, 0]));
          framed.set(body, 36);
          try {
            const rebuilt = rebuildGlyf(framed);
            expect(rebuilt.loca.length).toBe(4 * (numGlyphs + 1));
          } catch (thrown) {
            expect(thrown).toBeInstanceOf(Woff2GlyfError);
          }
        },
      ),
    );
  });
});

describe('measureWebRatio', () => {
  it('flags a failed shaping instead of hiding it', async () => {
    const metrics = font(
      Array.from({ length: 95 }, (_, index) => 0x20 + index),
      540,
    );
    expect(await measureWebRatio(new Uint8Array(64), metrics, 'en')).toEqual({
      ratio: 1,
      failed: true,
    });
  });
});
