import { describe, expect, it } from 'vitest';
import { checkBackground, sniffImage } from './background-image';
import { MAX_BACKGROUND_BYTES, MAX_BACKGROUND_SIDE } from './background-options';

const text = (value: string) => [...value].map((char) => char.charCodeAt(0));
const be32 = (value: number) => [
  value >>> 24,
  (value >>> 16) & 255,
  (value >>> 8) & 255,
  value & 255,
];
const le16 = (value: number) => [value & 255, value >>> 8];
const le24 = (value: number) => [value & 255, (value >>> 8) & 255, (value >>> 16) & 255];

const png = (width: number, height: number) =>
  Uint8Array.from([
    0x89,
    ...text('PNG'),
    13,
    10,
    26,
    10,
    ...be32(13),
    ...text('IHDR'),
    ...be32(width),
    ...be32(height),
    8,
    6,
    0,
    0,
    0,
  ]);
const gif = (width: number, height: number) =>
  Uint8Array.from([...text('GIF89a'), ...le16(width), ...le16(height), 0, 0, 0]);
const jpeg = (width: number, height: number) =>
  Uint8Array.from([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0,
    4,
    0,
    0,
    0xff,
    0xc0,
    0,
    11,
    8,
    height >> 8,
    height & 255,
    width >> 8,
    width & 255,
    1,
    1,
    0x11,
    0,
  ]);
const webpX = (width: number, height: number) =>
  Uint8Array.from([
    ...text('RIFF'),
    0,
    0,
    0,
    0,
    ...text('WEBP'),
    ...text('VP8X'),
    10,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    ...le24(width - 1),
    ...le24(height - 1),
  ]);
const webpLossy = (width: number, height: number) =>
  Uint8Array.from([
    ...text('RIFF'),
    0,
    0,
    0,
    0,
    ...text('WEBP'),
    ...text('VP8 '),
    10,
    0,
    0,
    0,
    0,
    0,
    0,
    0x9d,
    0x01,
    0x2a,
    ...le16(width),
    ...le16(height),
  ]);

describe('background image sniffing', () => {
  it.each([
    ['png', png(640, 480), 'image/png'],
    ['gif', gif(640, 480), 'image/gif'],
    ['jpeg', jpeg(640, 480), 'image/jpeg'],
    ['webp extended', webpX(640, 480), 'image/webp'],
    ['webp lossy', webpLossy(640, 480), 'image/webp'],
  ])('reads the type and size of a %s header', (_name, bytes, type) => {
    expect(sniffImage(bytes)).toEqual({ type, width: 640, height: 480 });
  });

  it('rejects other content, including SVG and a spoofed header', () => {
    expect(
      sniffImage(Uint8Array.from(text('<svg xmlns="http://www.w3.org/2000/svg"/>'))),
    ).toBeNull();
    expect(sniffImage(Uint8Array.from(text('<!doctype html><script>')))).toBeNull();
    expect(sniffImage(new Uint8Array(0))).toBeNull();
    expect(sniffImage(Uint8Array.from([0xff, 0xd8, 0xff]))).toBeNull();
  });

  it('does not run past a truncated or looping JPEG', () => {
    expect(
      sniffImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])),
    ).toBeNull();
    expect(sniffImage(Uint8Array.from([0xff, 0xd8, ...new Array(40).fill(0xff)]))).toBeNull();
  });
});

describe('background image limits', () => {
  it('accepts an image within the limits', () => {
    expect(checkBackground(1000, png(1920, 1080))).toMatchObject({ ok: true });
  });

  it('rejects a file that is too large before reading it', () => {
    expect(checkBackground(MAX_BACKGROUND_BYTES + 1, png(10, 10))).toEqual({
      ok: false,
      reason: 'size',
    });
  });

  it('rejects an unknown type', () => {
    expect(checkBackground(10, Uint8Array.from(text('hello world, not an image')))).toEqual({
      ok: false,
      reason: 'type',
    });
  });

  it('rejects images with too many pixels or a long side', () => {
    expect(checkBackground(10, png(MAX_BACKGROUND_SIDE + 1, 10))).toEqual({
      ok: false,
      reason: 'dimensions',
    });
    expect(checkBackground(10, png(8000, 8000))).toEqual({ ok: false, reason: 'dimensions' });
  });

  it('rejects zero dimensions', () => {
    expect(checkBackground(10, png(0, 10))).toEqual({ ok: false, reason: 'unreadable' });
  });
});
