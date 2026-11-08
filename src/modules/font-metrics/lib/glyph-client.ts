import { runWorkerTask } from '@/common/lib';
import {
  GLYPH_TIMEOUT_MS,
  type GlyphRequest,
  type GlyphResponse,
  type GlyphTable,
} from './glyph-model';
import { validateFontBuffer } from './validate';

function isGlyphResponse(data: unknown): data is GlyphResponse {
  if (typeof data !== 'object' || data === null || !('ok' in data)) return false;
  if (data.ok === false) return true;
  const response = data as Partial<Extract<GlyphResponse, { ok: true }>>;
  if (response.kind === 'outline') {
    return response.path === null || typeof response.path === 'string';
  }
  if (response.kind !== 'table') return false;
  const { table } = response;
  return (
    typeof table === 'object' &&
    table !== null &&
    Number.isInteger(table.count) &&
    table.advances instanceof Float64Array &&
    table.bounds instanceof Float64Array &&
    table.flags instanceof Uint8Array &&
    table.advances.length === table.count &&
    table.bounds.length === table.count * 4 &&
    table.flags.length === table.count &&
    Array.isArray(table.alternates)
  );
}

function request(message: GlyphRequest, signal?: AbortSignal): Promise<GlyphResponse | null> {
  try {
    validateFontBuffer(message.buffer);
  } catch {
    return Promise.resolve(null);
  }
  return runWorkerTask<GlyphRequest, GlyphResponse>(
    () => new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' }),
    message,
    {
      timeoutMs: GLYPH_TIMEOUT_MS,
      transfer: [message.buffer],
      ...(signal ? { signal } : {}),
      isResponse: isGlyphResponse,
    },
  ).catch(() => null);
}

export async function inspectGlyphs(
  bytes: ArrayBuffer,
  signal?: AbortSignal,
): Promise<GlyphTable | null> {
  const response = await request({ kind: 'table', buffer: bytes.slice(0) }, signal);
  return response?.ok && response.kind === 'table' ? response.table : null;
}

export async function glyphOutline(
  bytes: ArrayBuffer,
  glyph: number,
  signal?: AbortSignal,
): Promise<string | null> {
  const response = await request({ kind: 'outline', buffer: bytes.slice(0), glyph }, signal);
  return response?.ok && response.kind === 'outline' ? response.path : null;
}
