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

export interface FontState {
  kind?: Category;
  style?: FontStyleKey;
  picks?: Partial<Record<OsId, string[]>>;
  manual?: Record<string, Partial<Record<ManualKey, number>>>;
}

export interface ShareState extends FontState {
  v: number;
  query?: string;
  fontName?: string;
  preset?: string;
  others?: Record<string, FontState>;
  disabled?: OsId[];
  range?: boolean;
  scripts?: boolean;
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

function migrate(
  input: Record<string, unknown>,
  migrations: Readonly<Record<number, Migration>>,
): Record<string, unknown> | null {
  let current = input;
  while (typeof current.v === 'number' && current.v < SHARE_VERSION) {
    const step = migrations[current.v];
    if (!step) return null;
    current = { ...step(current), v: current.v + 1 };
  }
  return current.v === SHARE_VERSION ? current : null;
}

const MAX_OTHER_FONTS = 32;

function parseFontState(input: Record<string, unknown>): FontState {
  const state: FontState = {};
  if (KINDS.includes(input.kind as Category)) state.kind = input.kind as Category;
  if (STYLES.includes(input.style as FontStyleKey)) state.style = input.style as FontStyleKey;
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
  return state;
}

export function parseShareState(
  raw: unknown,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
): ShareState | null {
  if (!isRecord(raw)) return null;
  const input = migrate(raw, migrations);
  if (!input) return null;
  const state: ShareState = { v: SHARE_VERSION };
  if (typeof input.query === 'string' && input.query.length <= 500) state.query = input.query;
  if (typeof input.fontName === 'string' && input.fontName.length <= 200) {
    state.fontName = input.fontName;
  }
  Object.assign(state, parseFontState(input));
  if (typeof input.preset === 'string' && ID.test(input.preset)) state.preset = input.preset;
  if (Array.isArray(input.disabled)) {
    state.disabled = input.disabled.filter((os): os is OsId => OS_LIST.includes(os as OsId));
  }
  if (isRecord(input.others)) {
    const others: NonNullable<ShareState['others']> = {};
    for (const [name, value] of Object.entries(input.others).slice(0, MAX_OTHER_FONTS)) {
      if (name.length <= 200 && name !== '__proto__' && isRecord(value))
        others[name] = parseFontState(value);
    }
    state.others = others;
  }
  if (typeof input.range === 'boolean') state.range = input.range;
  if (typeof input.scripts === 'boolean') state.scripts = input.scripts;
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
