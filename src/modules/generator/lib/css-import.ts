export const MAX_CSS_CHARS = 14_000_000;
export const MAX_FACES = 64;
const MAX_RULES = 1024;
export const MAX_DATA_URL_BYTES = 10 * 1024 * 1024;

export interface ImportedSource {
  url: string;
  format: string | null;
}

export interface ImportedFace {
  family: string;
  weight: string;
  style: string;
  sources: ImportedSource[];
  skipped: number;
}

function stripComments(css: string): string {
  let result = '';
  let position = 0;
  for (;;) {
    const start = css.indexOf('/*', position);
    if (start < 0) return result + css.slice(position);
    result += css.slice(position, start);
    const end = css.indexOf('*/', start + 2);
    if (end < 0) return result;
    position = end + 2;
  }
}

function declarations(block: string): Map<string, string> {
  const result = new Map<string, string>();
  let depth = 0;
  let quote = '';
  let start = 0;
  const flush = (end: number) => {
    const text = block.slice(start, end);
    const colon = text.indexOf(':');
    if (colon > 0)
      result.set(text.slice(0, colon).trim().toLowerCase(), text.slice(colon + 1).trim());
    start = end + 1;
  };
  for (let index = 0; index < block.length; index++) {
    const char = block[index];
    if (quote) {
      if (char === quote) quote = '';
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '(') depth++;
    else if (char === ')') depth = Math.max(0, depth - 1);
    else if (char === ';' && depth === 0) flush(index);
  }
  flush(block.length);
  return result;
}

function unquote(value: string | undefined): string {
  return (value ?? '').trim().replace(/^["']|["']$/g, '');
}

function readSources(value: string): ImportedSource[] {
  const lower = value.toLowerCase();
  const sources: ImportedSource[] = [];
  let position = 0;
  while (sources.length < MAX_FACES) {
    const open = lower.indexOf('url(', position);
    if (open < 0) break;
    let cursor = open + 4;
    while (cursor < value.length && /\s/.test(value[cursor] ?? '')) cursor++;
    const quote = value[cursor] === '"' || value[cursor] === "'" ? value[cursor] : '';
    let url: string;
    if (quote) {
      const end = value.indexOf(quote, cursor + 1);
      if (end < 0) break;
      url = value.slice(cursor + 1, end);
      cursor = end + 1;
    } else {
      const end = value.indexOf(')', cursor);
      if (end < 0) break;
      url = value.slice(cursor, end).trim();
      cursor = end;
    }
    const close = value.indexOf(')', cursor);
    if (close < 0) break;
    position = close + 1;
    let format: string | null = null;
    let after = position;
    while (after < value.length && /\s/.test(value[after] ?? '')) after++;
    if (lower.startsWith('format(', after)) {
      const end = value.indexOf(')', after);
      if (end > 0) {
        format = unquote(value.slice(after + 7, end)).toLowerCase();
        position = end + 1;
      }
    }
    if (url) sources.push({ url, format });
  }
  return sources;
}

const weightKey = (weight: string) => {
  const value = weight.trim().toLowerCase();
  return value === 'normal' ? '400' : value === 'bold' ? '700' : value;
};
const styleKey = (style: string) => (/italic|oblique/i.test(style) ? 'italic' : 'normal');

function coversLatin(range: string | undefined): boolean {
  if (!range) return true;
  return range.split(',').some((part) => {
    const match = /^u\+([0-9a-f?]{1,6})(?:-([0-9a-f]{1,6}))?$/i.exec(part.trim());
    if (!match) return false;
    const first = match[1] ?? '';
    const wild = first.includes('?');
    const low = Number.parseInt(first.replace(/\?/g, '0'), 16);
    const high = wild
      ? Number.parseInt(first.replace(/\?/g, 'f'), 16)
      : match[2]
        ? Number.parseInt(match[2], 16)
        : low;
    return [0x41, 0x61].some((point) => point >= low && point <= high);
  });
}

export function parseFontFaces(css: string): ImportedFace[] {
  if (css.length > MAX_CSS_CHARS) return [];
  const clean = stripComments(css);
  const lower = clean.toLowerCase();
  const faces: ImportedFace[] = [];
  const slots = new Map<string, number>();
  const latin = new Set<ImportedFace>();
  let rules = 0;
  let position = 0;
  while (rules < MAX_RULES) {
    const keyword = lower.indexOf('@font-face', position);
    if (keyword < 0) break;
    let cursor = keyword + 10;
    while (cursor < clean.length && /\s/.test(clean[cursor] ?? '')) cursor++;
    if (clean[cursor] !== '{') {
      position = keyword + 10;
      continue;
    }
    const end = clean.indexOf('}', cursor + 1);
    if (end < 0) break;
    position = end + 1;
    const values = declarations(clean.slice(cursor + 1, end));
    const family = unquote(values.get('font-family')).slice(0, 200);
    const sources = readSources(values.get('src') ?? '');
    rules++;
    if (!family || sources.length === 0) continue;
    const face: ImportedFace = {
      family,
      weight: (values.get('font-weight') ?? 'normal').slice(0, 20),
      style: (values.get('font-style') ?? 'normal').slice(0, 20),
      sources,
      skipped: 0,
    };
    const covers = coversLatin(values.get('unicode-range')?.slice(0, 4096));
    const key = `${family.toLowerCase()}|${weightKey(face.weight)}|${styleKey(face.style)}`;
    const slot = slots.get(key);
    if (slot === undefined) {
      if (faces.length >= MAX_FACES) continue;
      slots.set(key, faces.length);
      faces.push(face);
      if (covers) latin.add(face);
      continue;
    }
    const current = faces[slot];
    if (!current) continue;
    if (covers && !latin.has(current)) {
      face.skipped = current.skipped + 1;
      latin.add(face);
      faces[slot] = face;
    } else current.skipped++;
  }
  return faces;
}

const DATA_URL =
  /^data:((?:font|application)\/[a-z0-9.+-]+)(?:;[a-z0-9=.+-]+)*;base64,([a-z0-9+/=\s]+)$/i;

export interface DecodedFont {
  bytes: ArrayBuffer;
  mime: string;
}

export function decodeDataUrl(url: string): DecodedFont | null {
  if (url.length > MAX_DATA_URL_BYTES * 1.4) return null;
  const match = DATA_URL.exec(url);
  if (!match) return null;
  try {
    const binary = atob((match[2] ?? '').replace(/\s+/g, ''));
    if (binary.length > MAX_DATA_URL_BYTES) return null;
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return { bytes: bytes.buffer, mime: (match[1] ?? '').toLowerCase() };
  } catch {
    return null;
  }
}

export function safeHttpsUrl(url: string): URL | null {
  try {
    const parsed = new URL(url, 'https://invalid.invalid/');
    return parsed.protocol === 'https:' &&
      parsed.hostname !== 'invalid.invalid' &&
      !parsed.username &&
      !parsed.password
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export type Pick =
  | { kind: 'data'; font: DecodedFont }
  | { kind: 'link'; url: URL }
  | { kind: 'none' };

export function pickSource(face: ImportedFace): Pick {
  for (const source of face.sources) {
    const font = decodeDataUrl(source.url);
    if (font) return { kind: 'data', font };
  }
  for (const source of face.sources) {
    const url = safeHttpsUrl(source.url);
    if (url) return { kind: 'link', url };
  }
  return { kind: 'none' };
}

export interface GoogleFamily {
  name: string;
  styles: string;
}

export function parseGoogleFontsLinks(text: string): GoogleFamily[] {
  if (text.length > MAX_CSS_CHARS) return [];
  const families: GoogleFamily[] = [];
  const urls = text.matchAll(/https:\/\/fonts\.googleapis\.com\/css2?\?[^\s"'<>)]+/gi);
  for (const [raw] of urls) {
    if (families.length >= MAX_FACES) break;
    let params: URLSearchParams;
    try {
      params = new URL(raw.replace(/&amp;/g, '&')).searchParams;
    } catch {
      continue;
    }
    for (const value of params.getAll('family')) {
      const [name, styles = ''] = value.split(':');
      const clean = (name ?? '').replace(/\+/g, ' ').trim().slice(0, 100);
      if (clean && families.length < MAX_FACES) families.push({ name: clean, styles });
    }
  }
  return families;
}
