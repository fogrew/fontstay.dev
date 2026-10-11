import type { Category, OsId } from '@/modules/os-fonts';
import type { FontStyleKey } from './per-os';

export const SHARE_VERSION = 1;
export const MAX_HASH_CHARS = 8000;
export const MAX_STATE_CHARS = 32_000;

export const MANUAL_KEYS = [
  'sizeAdjust',
  'ascentOverride',
  'descentOverride',
  'lineGapOverride',
] as const;
export type ManualKey = (typeof MANUAL_KEYS)[number];

export interface ShareState {
  v: number;
  query?: string;
  fontName?: string;
  kind?: Category;
  style?: FontStyleKey;
  disabled?: OsId[];
  picks?: Partial<Record<OsId, string[]>>;
  manual?: Record<string, Partial<Record<ManualKey, number>>>;
  range?: boolean;
  spacing?: { on: boolean; letter?: number; word?: number };
}

const OS_LIST: readonly OsId[] = ['windows', 'macos', 'ios', 'android', 'linux', 'chromeos'];
const KINDS: readonly Category[] = ['sans-serif', 'serif', 'monospace'];
const STYLES: readonly FontStyleKey[] = ['regular', 'bold', 'italic', 'bold-italic'];
const ID = /^[a-z0-9-]{1,40}$/;
const LIMITS: Record<ManualKey, [number, number]> = {
  sizeAdjust: [25, 400],
  ascentOverride: [0, 400],
  descentOverride: [0, 400],
  lineGapOverride: [0, 400],
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const finite = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

type Migration = (state: Record<string, unknown>) => Record<string, unknown>;

export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

function migrate(input: Record<string, unknown>): Record<string, unknown> | null {
  let current = input;
  while (typeof current.v === 'number' && current.v < SHARE_VERSION) {
    const step = MIGRATIONS[current.v];
    if (!step) return null;
    current = { ...step(current), v: current.v + 1 };
  }
  return current.v === SHARE_VERSION ? current : null;
}

export function parseShareState(raw: unknown): ShareState | null {
  if (!isRecord(raw)) return null;
  const input = migrate(raw);
  if (!input) return null;
  const state: ShareState = { v: SHARE_VERSION };
  if (typeof input.query === 'string' && input.query.length <= 500) state.query = input.query;
  if (typeof input.fontName === 'string' && input.fontName.length <= 200) {
    state.fontName = input.fontName;
  }
  if (KINDS.includes(input.kind as Category)) state.kind = input.kind as Category;
  if (STYLES.includes(input.style as FontStyleKey)) state.style = input.style as FontStyleKey;
  if (Array.isArray(input.disabled)) {
    state.disabled = input.disabled.filter((os): os is OsId => OS_LIST.includes(os as OsId));
  }
  if (isRecord(input.picks)) {
    const picks: NonNullable<ShareState['picks']> = {};
    for (const os of OS_LIST) {
      const list = input.picks[os];
      if (Array.isArray(list)) {
        picks[os] = list
          .filter((id): id is string => typeof id === 'string' && ID.test(id))
          .slice(0, 16);
      }
    }
    state.picks = picks;
  }
  if (isRecord(input.manual)) {
    const manual: NonNullable<ShareState['manual']> = {};
    for (const [faceId, values] of Object.entries(input.manual).slice(0, 32)) {
      if (!ID.test(faceId) || !isRecord(values)) continue;
      const entry: Partial<Record<ManualKey, number>> = {};
      for (const key of MANUAL_KEYS) {
        const [min, max] = LIMITS[key];
        if (finite(values[key], min, max)) entry[key] = values[key];
      }
      manual[faceId] = entry;
    }
    state.manual = manual;
  }
  if (typeof input.range === 'boolean') state.range = input.range;
  if (isRecord(input.spacing) && typeof input.spacing.on === 'boolean') {
    state.spacing = { on: input.spacing.on };
    if (finite(input.spacing.letter, -5, 5)) state.spacing.letter = input.spacing.letter;
    if (finite(input.spacing.word, -30, 30)) state.spacing.word = input.spacing.word;
  }
  return state;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

async function pipe(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
  limit: number,
) {
  const writer = stream.writable.getWriter();
  void writer.write(bytes as unknown as BufferSource).catch(() => undefined);
  void writer.close().catch(() => undefined);
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new Error('too-large');
    }
    chunks.push(value);
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export async function encodeShareState(state: ShareState): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(state));
  const packed = await pipe(json, new CompressionStream('deflate-raw'), MAX_STATE_CHARS);
  return toBase64Url(packed);
}

export async function decodeShareState(payload: string): Promise<ShareState | null> {
  if (payload.length === 0 || payload.length > MAX_HASH_CHARS) return null;
  const bytes = fromBase64Url(payload);
  if (!bytes) return null;
  try {
    const json = await pipe(bytes, new DecompressionStream('deflate-raw'), MAX_STATE_CHARS);
    return parseShareState(JSON.parse(new TextDecoder().decode(json)));
  } catch {
    return null;
  }
}

export const HASH_KEY = 's=';

export function payloadFromHash(hash: string): string | null {
  const text = hash.startsWith('#') ? hash.slice(1) : hash;
  return text.startsWith(HASH_KEY) ? text.slice(HASH_KEY.length) : null;
}
