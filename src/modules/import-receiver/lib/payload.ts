export const PAYLOAD_VERSION = 1;
export const MAX_FILES = 8;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 30 * 1024 * 1024;
export const MAX_FACES = 64;
export const MAX_USED = 16;
export const MAX_SAMPLES = 40;
export const MAX_SAMPLE_CHARS = 12_000;
export const MAX_TEXT = 1200;
export const MAX_URL = 2000;
export const MAX_METADATA_BYTES = 200_000;

export const ROLES = ['body', 'h1', 'h2', 'h3', 'button'] as const;
export type Role = (typeof ROLES)[number];

export interface ImportedFace {
  family: string;
  weight: number;
  style: 'normal' | 'italic';
  url?: string;
}

export interface ImportedUse {
  role: Role;
  family: string;
  size: number;
  lineHeight?: number;
  weight: number;
}

export const SAMPLE_ROLES = ['heading', 'subheading', 'body', 'quote', 'item'] as const;
export type SampleRole = (typeof SAMPLE_ROLES)[number];

export interface ImportedSample {
  role: SampleRole;
  text: string;
}

export interface ImportedFile {
  name: string;
  bytes: ArrayBuffer;
}

export interface SiteImport {
  v: typeof PAYLOAD_VERSION;
  origin: string;
  verified: boolean;
  title: string;
  faces: ImportedFace[];
  used: ImportedUse[];
  samples: ImportedSample[];
  files: ImportedFile[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const CONTROL = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;
const KEEP_FORMAT = new Set(String.fromCodePoint(0x200c, 0x200d, 0x200e, 0x200f, 0x61c));

export function cleanText(value: unknown, limit: number): string {
  if (typeof value !== 'string') return '';
  const wellFormed = value.length > limit * 4 ? value.slice(0, limit * 4) : value;
  const stripped = wellFormed
    .toWellFormed()
    .replace(CONTROL, (char) => (KEEP_FORMAT.has(char) ? char : ' '))
    .replace(/(\p{M}{3})\p{M}+/gu, '$1')
    .replace(/\s+/gu, ' ')
    .trim();
  return [...stripped].slice(0, limit).join('');
}

export function cleanName(value: unknown): string {
  const base = cleanText(value, 200).split(/[\\/]/u).pop() ?? '';
  const safe = base.replace(/[^\p{L}\p{N}._ -]/gu, '-').replace(/^\.+/u, '');
  return safe.slice(0, 100) || 'font';
}

export function cleanUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > MAX_URL) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

function number(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : undefined;
}

export function cleanOrigin(value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : '';
  } catch {
    return '';
  }
}

function faces(raw: unknown): ImportedFace[] {
  if (!Array.isArray(raw)) return [];
  const result: ImportedFace[] = [];
  for (const item of raw.slice(0, MAX_FACES)) {
    if (!isRecord(item)) continue;
    const family = cleanText(item.family, 200);
    if (!family) continue;
    const url = cleanUrl(item.url);
    result.push({
      family,
      weight: number(item.weight, 1, 1000) ?? 400,
      style: item.style === 'italic' ? 'italic' : 'normal',
      ...(url ? { url } : {}),
    });
  }
  return result;
}

function used(raw: unknown): ImportedUse[] {
  if (!Array.isArray(raw)) return [];
  const result: ImportedUse[] = [];
  for (const item of raw.slice(0, MAX_USED)) {
    if (!isRecord(item) || !ROLES.includes(item.role as Role)) continue;
    const family = cleanText(item.family, 500);
    const size = number(item.size, 1, 400);
    if (!family || size === undefined) continue;
    const lineHeight = number(item.lineHeight, 0.5, 10);
    result.push({
      role: item.role as Role,
      family,
      size,
      weight: number(item.weight, 1, 1000) ?? 400,
      ...(lineHeight === undefined ? {} : { lineHeight }),
    });
  }
  return result;
}

function samples(raw: unknown): ImportedSample[] {
  if (!Array.isArray(raw)) return [];
  const result: ImportedSample[] = [];
  let total = 0;
  for (const item of raw.slice(0, MAX_SAMPLES)) {
    if (!isRecord(item) || !SAMPLE_ROLES.includes(item.role as SampleRole)) continue;
    const text = cleanText(item.text, MAX_TEXT);
    if (!text || total + text.length > MAX_SAMPLE_CHARS) continue;
    total += text.length;
    result.push({ role: item.role as SampleRole, text });
  }
  return result;
}

function files(raw: unknown): ImportedFile[] {
  if (!Array.isArray(raw)) return [];
  const result: ImportedFile[] = [];
  let total = 0;
  for (const item of raw.slice(0, MAX_FILES)) {
    if (!isRecord(item) || !(item.bytes instanceof ArrayBuffer)) continue;
    const size = item.bytes.byteLength;
    if (size === 0 || size > MAX_FILE_BYTES || total + size > MAX_TOTAL_BYTES) continue;
    total += size;
    result.push({ name: cleanName(item.name), bytes: item.bytes });
  }
  return result;
}

export function sanitizeImport(raw: unknown, origin: string, verified: boolean): SiteImport | null {
  if (!isRecord(raw) || raw.v !== PAYLOAD_VERSION) return null;
  const trusted = cleanOrigin(origin);
  if (!trusted) return null;
  const result: SiteImport = {
    v: PAYLOAD_VERSION,
    origin: trusted,
    verified,
    title: cleanText(raw.title, 200),
    faces: faces(raw.faces),
    used: used(raw.used),
    samples: samples(raw.samples),
    files: files(raw.files),
  };
  const empty =
    result.faces.length + result.used.length + result.samples.length + result.files.length === 0;
  return empty ? null : result;
}

export function parseClipboardImport(text: string): SiteImport | null {
  if (text.length > MAX_METADATA_BYTES) return null;
  try {
    const raw: unknown = JSON.parse(text);
    if (!isRecord(raw)) return null;
    return sanitizeImport({ ...raw, files: [] }, String(raw.origin ?? ''), false);
  } catch {
    return null;
  }
}
