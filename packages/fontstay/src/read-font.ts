import { open, stat } from 'node:fs/promises';
import { FontParseError, MAX_FONT_BYTES } from '@/modules/font-metrics';

export async function readFont(path: string): Promise<Uint8Array> {
  // Opening a FIFO or device blocks, so reject anything but a regular file before open().
  if (!(await stat(path)).isFile()) throw new FontParseError('invalid-font');
  const handle = await open(path, 'r');
  try {
    const buffer = Buffer.alloc(MAX_FONT_BYTES + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > MAX_FONT_BYTES) throw new FontParseError('too-large');
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

export function arrayBufferOf(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}
