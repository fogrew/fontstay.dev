import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { shapedWidthEm } from './shaping';

const fixture = (name: string) => {
  const bytes = readFileSync(new URL(`../../../../tests/fixtures/fonts/${name}`, import.meta.url));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
};

const TEXT = 'Hamburgefonstiv AV 0123';

describe('variable fonts without HVAR in web containers', () => {
  it.each(['Mada-VF.woff', 'Mada-VF.woff2', 'Mada-VF-hmtx.woff2'])(
    'shapes %s like the plain TTF at a non-default weight',
    async (name) => {
      const variation = { wght: 900 };
      const expected = await shapedWidthEm(fixture('Mada-VF.ttf'), TEXT, { variation });
      const actual = await shapedWidthEm(fixture(name), TEXT, { variation });
      expect(actual).toBeCloseTo(expected, 4);
      expect(expected).not.toBeCloseTo(await shapedWidthEm(fixture('Mada-VF.ttf'), TEXT), 2);
    },
  );
});
