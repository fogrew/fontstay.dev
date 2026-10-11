import { runWorkerTask, WorkerTaskError } from '@/common/lib';
import {
  FONT_PARSE_ERROR_CODES,
  FONT_PARSE_TIMEOUT_MS,
  FontParseError,
  type FontParseResult,
} from './model';
import { validateFontBuffer } from './validate';

const CATEGORIES = new Set(['sans-serif', 'serif', 'monospace']);

function isStyleInfo(style: unknown): boolean {
  if (typeof style !== 'object' || style === null) return false;
  const { weight, italic, category } = style as Record<string, unknown>;
  return (
    typeof weight === 'number' &&
    Number.isFinite(weight) &&
    typeof italic === 'boolean' &&
    (category === null || (typeof category === 'string' && CATEGORIES.has(category)))
  );
}

function isFontParseResult(data: unknown): data is FontParseResult {
  if (typeof data !== 'object' || data === null || !('ok' in data)) return false;
  if (data.ok === true) {
    const { font } = data as { font?: Record<string, unknown> };
    return (
      typeof font === 'object' &&
      font !== null &&
      font.codePoints instanceof Uint32Array &&
      font.advances instanceof Float64Array &&
      font.codePoints.length === font.advances.length &&
      typeof font.unitsPerEm === 'number' &&
      typeof font.isVariable === 'boolean' &&
      isStyleInfo(font.style) &&
      typeof font.names === 'object' &&
      font.names !== null &&
      typeof font.hhea === 'object' &&
      font.hhea !== null
    );
  }
  const { error } = data as { error?: { code?: unknown } };
  return data.ok === false && FONT_PARSE_ERROR_CODES.some((code) => code === error?.code);
}

export interface FontParser {
  parse(buffer: ArrayBuffer): Promise<FontParseResult>;
  dispose(): void;
}

export function createFontParser(): FontParser {
  let disposed = false;
  let active: AbortController | undefined;
  return {
    async parse(buffer) {
      if (disposed) return { ok: false, error: { code: 'disposed' } };
      if (active) return { ok: false, error: { code: 'busy' } };
      try {
        validateFontBuffer(buffer);
      } catch (error) {
        return {
          ok: false,
          error: { code: error instanceof FontParseError ? error.code : 'invalid-font' },
        };
      }
      active = new AbortController();
      try {
        return await runWorkerTask<ArrayBuffer, FontParseResult>(
          () => new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' }),
          buffer,
          {
            timeoutMs: FONT_PARSE_TIMEOUT_MS,
            transfer: [buffer],
            signal: active.signal,
            isResponse: isFontParseResult,
          },
        );
      } catch (error) {
        return {
          ok: false,
          error: {
            code:
              error instanceof WorkerTaskError && error.code === 'timeout'
                ? 'timeout'
                : disposed
                  ? 'disposed'
                  : 'worker-error',
          },
        };
      } finally {
        active = undefined;
      }
    },
    dispose() {
      disposed = true;
      active?.abort();
    },
  };
}
