export const MAX_CSS_BYTES = 400_000;
export const MAX_FACES = 64;
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
}

function stripComments(css: string): string {
  let result = css;
  let previous: string;
  do {
    previous = result;
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  } while (result !== previous);
  return result;
}

function declarations(block: string): Map<string, string> {
  const result = new Map<string, string>();
  let depth = 0;
  let quote = '';
  let current = '';
  const flush = () => {
    const colon = current.indexOf(':');
    if (colon > 0) {
      const name = current.slice(0, colon).trim().toLowerCase();
      if (!result.has(name)) result.set(name, current.slice(colon + 1).trim());
    }
    current = '';
  };
  for (const char of block) {
    if (quote) {
      if (char === quote) quote = '';
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '(') depth++;
    else if (char === ')') depth = Math.max(0, depth - 1);
    else if (char === ';' && depth === 0) {
      flush();
      continue;
    }
    current += char;
  }
  flush();
  return result;
}

const SOURCE =
  /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)(?:\s*format\(\s*["']?([^"')]+)["']?\s*\))?/gi;

function unquote(value: string | undefined): string {
  return (value ?? '').trim().replace(/^["']|["']$/g, '');
}

export function parseFontFaces(css: string): ImportedFace[] {
  if (css.length > MAX_CSS_BYTES) return [];
  const faces: ImportedFace[] = [];
  const blocks = stripComments(css).matchAll(/@font-face\s*\{([^}]*)\}/gi);
  for (const [, body] of blocks) {
    if (faces.length >= MAX_FACES) break;
    const values = declarations(body ?? '');
    const family = unquote(values.get('font-family')).slice(0, 200);
    const src = values.get('src') ?? '';
    const sources: ImportedSource[] = [];
    for (const match of src.matchAll(SOURCE)) {
      const url = (match[1] ?? match[2] ?? match[3] ?? '').trim();
      if (url) sources.push({ url, format: match[4]?.trim().toLowerCase() ?? null });
    }
    if (family && sources.length > 0) {
      faces.push({
        family,
        weight: (values.get('font-weight') ?? 'normal').slice(0, 20),
        style: (values.get('font-style') ?? 'normal').slice(0, 20),
        sources,
      });
    }
  }
  return faces;
}

const DATA_URL =
  /^data:(?:font|application)\/[a-z0-9.+-]+(?:;[a-z0-9=.+-]+)*;base64,([a-z0-9+/=\s]+)$/i;

export function decodeDataUrl(url: string): ArrayBuffer | null {
  if (url.length > MAX_DATA_URL_BYTES * 1.4) return null;
  const match = DATA_URL.exec(url);
  if (!match) return null;
  try {
    const binary = atob((match[1] ?? '').replace(/\s+/g, ''));
    if (binary.length > MAX_DATA_URL_BYTES) return null;
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes.buffer;
  } catch {
    return null;
  }
}

export function safeHttpsUrl(url: string): string | null {
  try {
    const parsed = new URL(url, 'https://invalid.invalid/');
    return parsed.protocol === 'https:' && parsed.hostname !== 'invalid.invalid'
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

export interface GoogleFamily {
  name: string;
  styles: string;
}

export function parseGoogleFontsLinks(text: string): GoogleFamily[] {
  if (text.length > MAX_CSS_BYTES) return [];
  const families: GoogleFamily[] = [];
  const urls = text.matchAll(/https:\/\/fonts\.googleapis\.com\/css2?\?[^\s"'<>)]+/gi);
  for (const [raw] of urls) {
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
