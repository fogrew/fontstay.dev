import {
  type BackgroundRejection,
  type BackgroundType,
  MAX_BACKGROUND_BYTES,
  MAX_BACKGROUND_PIXELS,
  MAX_BACKGROUND_SIDE,
} from './background-options';

const SNIFF_BYTES = 256 * 1024;

export interface BackgroundInfo {
  type: BackgroundType;
  width: number;
  height: number;
}

const ascii = (bytes: Uint8Array, at: number, text: string) =>
  [...text].every((char, index) => bytes[at + index] === char.charCodeAt(0));

function jpegSize(bytes: Uint8Array, view: DataView): BackgroundInfo | null {
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1] ?? 0;
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2;
      continue;
    }
    const length = view.getUint16(at + 2);
    if (length < 2) return null;
    const frame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (frame) {
      return {
        type: 'image/jpeg',
        height: view.getUint16(at + 5),
        width: view.getUint16(at + 7),
      };
    }
    at += 2 + length;
  }
  return null;
}

function webpSize(bytes: Uint8Array, view: DataView): BackgroundInfo | null {
  if (bytes.length < 30) return null;
  const type = 'image/webp';
  if (ascii(bytes, 12, 'VP8 ')) {
    return {
      type,
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff,
    };
  }
  if (ascii(bytes, 12, 'VP8L') && bytes[20] === 0x2f) {
    const bits = view.getUint32(21, true);
    return { type, width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (ascii(bytes, 12, 'VP8X')) {
    const read = (at: number) =>
      (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8) | ((bytes[at + 2] ?? 0) << 16);
    return { type, width: read(24) + 1, height: read(27) + 1 };
  }
  return null;
}

export function sniffImage(bytes: Uint8Array): BackgroundInfo | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    bytes.length >= 24 &&
    ascii(bytes, 1, 'PNG') &&
    bytes[0] === 0x89 &&
    ascii(bytes, 12, 'IHDR')
  ) {
    return { type: 'image/png', width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (bytes.length >= 10 && (ascii(bytes, 0, 'GIF87a') || ascii(bytes, 0, 'GIF89a'))) {
    return { type: 'image/gif', width: view.getUint16(6, true), height: view.getUint16(8, true) };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) return jpegSize(bytes, view);
  if (bytes.length >= 12 && ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WEBP')) {
    return webpSize(bytes, view);
  }
  return null;
}

export function checkBackground(
  size: number,
  head: Uint8Array,
): { ok: true; info: BackgroundInfo } | { ok: false; reason: BackgroundRejection } {
  if (size > MAX_BACKGROUND_BYTES) return { ok: false, reason: 'size' };
  const info = sniffImage(head);
  if (!info) return { ok: false, reason: 'type' };
  const { width, height } = info;
  if (width < 1 || height < 1) return { ok: false, reason: 'unreadable' };
  if (
    width > MAX_BACKGROUND_SIDE ||
    height > MAX_BACKGROUND_SIDE ||
    width * height > MAX_BACKGROUND_PIXELS
  ) {
    return { ok: false, reason: 'dimensions' };
  }
  return { ok: true, info };
}

export async function loadBackground(
  file: File,
): Promise<{ ok: true; url: string } | { ok: false; reason: BackgroundRejection }> {
  if (file.size > MAX_BACKGROUND_BYTES) return { ok: false, reason: 'size' };
  let checked: ReturnType<typeof checkBackground>;
  try {
    const head = new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer());
    checked = checkBackground(file.size, head);
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  if (!checked.ok) return checked;
  const url = URL.createObjectURL(new Blob([file], { type: checked.info.type }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return { ok: true, url };
  } catch {
    URL.revokeObjectURL(url);
    return { ok: false, reason: 'unreadable' };
  }
}
