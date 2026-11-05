import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { FontParseError, MAX_FONT_BYTES } from '@/modules/font-metrics';

export class NetworkPathError extends Error {
  readonly code = 'ENETPATH';

  constructor(path: string) {
    super(`${path}: network paths are not supported`);
    this.name = 'NetworkPathError';
  }
}

const NETWORK_PATH = /^[\\/]{2}/;

export async function readFont(path: string): Promise<Uint8Array> {
  if (process.platform === 'win32' && NETWORK_PATH.test(path)) throw new NetworkPathError(path);
  // O_NONBLOCK keeps open() from blocking on a FIFO; it is undefined on Windows.
  const handle = await open(path, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0));
  try {
    if (!(await handle.stat()).isFile()) throw new FontParseError('invalid-font');
    const buffer = Buffer.alloc(MAX_FONT_BYTES + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > MAX_FONT_BYTES) throw new FontParseError('too-large');
    return Buffer.from(buffer.subarray(0, bytesRead));
  } finally {
    await handle.close();
  }
}

export function arrayBufferOf(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}
