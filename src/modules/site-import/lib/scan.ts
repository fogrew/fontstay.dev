export const MAX_SHEETS = 6;
export const MAX_FACES = 64;
export const MAX_RULES = 256;
export const MAX_RANGE = 1500;
export const MAX_CSS = 500_000;
const MAX_STARTS = 5000;
const MAX_TAG = 2000;
const MAX_INLINE = 20;

const PRIVATE_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.lan',
  '.home',
  '.corp',
  '.intranet',
];

export function parsePublicUrl(raw: string): URL | null {
  const text = raw.trim();
  if (text.length === 0 || text.length > 2000 || /\s/.test(text)) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    return url;
  } catch {
    return null;
  }
}

export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (host.includes(':') || host.startsWith('[')) return true;
  if (/^[\d.]+$/.test(host) || !host.includes('.') || host === 'localhost') return true;
  return PRIVATE_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

export function resolveHttps(href: string, base: string): string {
  try {
    const url = new URL(href.trim(), base);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}

const asciiLower = (text: string) => text.replace(/[A-Z]/g, (char) => char.toLowerCase());

function decodeAmp(value: string): string {
  return value.replace(/&amp;/gi, '&');
}

function attributes(tag: string): Map<string, string> {
  const result = new Map<string, string>();
  const pattern = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of tag.matchAll(pattern)) {
    const name = (match[1] ?? '').toLowerCase();
    if (!result.has(name)) result.set(name, decodeAmp(match[2] ?? match[3] ?? match[4] ?? ''));
  }
  return result;
}

function withoutComments(html: string): string {
  let result = '';
  let position = 0;
  for (let count = 0; count < MAX_STARTS; count++) {
    const start = html.indexOf('<!--', position);
    if (start < 0) break;
    result += html.slice(position, start);
    const end = html.indexOf('-->', start + 4);
    if (end < 0) return result;
    position = end + 3;
  }
  return result + html.slice(position);
}

export interface PageScan {
  hrefs: string[];
  inline: string[];
}

export function scanPage(source: string, base: string): PageScan {
  const html = withoutComments(source);
  const lower = asciiLower(html);
  const hrefs: string[] = [];
  const inline: string[] = [];

  let position = 0;
  for (let count = 0; count < MAX_STARTS && hrefs.length < MAX_SHEETS; count++) {
    const start = lower.indexOf('<link', position);
    if (start < 0) break;
    position = start + 5;
    if (!/[\s/>]/.test(lower[position] ?? '')) continue;
    const length = lower.slice(position, position + MAX_TAG).indexOf('>');
    if (length < 0) continue;
    const attrs = attributes(html.slice(position, position + length));
    const rel = (attrs.get('rel') ?? '').toLowerCase().split(/\s+/);
    const href = attrs.get('href');
    if (!href || !rel.includes('stylesheet') || rel.includes('alternate')) continue;
    const resolved = resolveHttps(href, base);
    if (resolved && !hrefs.includes(resolved)) hrefs.push(resolved);
  }

  position = 0;
  for (let count = 0; count < MAX_STARTS && inline.length < MAX_INLINE; count++) {
    const start = lower.indexOf('<style', position);
    if (start < 0) break;
    position = start + 6;
    if (!/[\s>]/.test(lower[position] ?? '')) continue;
    const open = lower.indexOf('>', position);
    if (open < 0) break;
    const close = lower.indexOf('</style', open);
    if (close < 0) break;
    inline.push(html.slice(open + 1, Math.min(close, open + 1 + MAX_CSS)));
    position = close;
  }
  return { hrefs, inline };
}

export interface ScannedFace {
  family: string;
  weight: number;
  style: 'normal' | 'italic';
  url?: string;
}

export interface ScannedRule {
  family: string;
  weight: string;
  style: 'normal' | 'italic';
  unicodeRange?: string;
}

export interface ScannedCss {
  faces: { face: ScannedFace; latin: boolean }[];
  rules: ScannedRule[];
  imports: string[];
}

const RANK: Record<string, number> = {
  woff2: 0,
  woff: 1,
  truetype: 2,
  opentype: 3,
  ttf: 2,
  otf: 3,
};

function stripComments(css: string): string {
  let result = '';
  let position = 0;
  for (let count = 0; count < MAX_STARTS; count++) {
    const start = css.indexOf('/*', position);
    if (start < 0) break;
    result += css.slice(position, start);
    const end = css.indexOf('*/', start + 2);
    if (end < 0) return result;
    position = end + 2;
  }
  return result + css.slice(position);
}

function declarations(block: string): Map<string, string> {
  const result = new Map<string, string>();
  let depth = 0;
  let quote = '';
  let start = 0;
  const flush = (end: number) => {
    const text = block.slice(start, end);
    const colon = text.indexOf(':');
    if (colon > 0) {
      result.set(text.slice(0, colon).trim().toLowerCase(), text.slice(colon + 1).trim());
    }
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

const unquote = (value: string) => value.trim().replace(/^["']|["']$/g, '');

function weightOf(value: string): number {
  const number = Number.parseInt(value, 10);
  if (number >= 1 && number <= 1000) return number;
  return /bold/i.test(value) ? 700 : 400;
}

function bestUrl(source: string, base: string): string {
  const src = source.slice(0, 2000);
  const lower = asciiLower(src);
  let best = '';
  let bestRank = 99;
  let position = 0;
  for (let count = 0; count < 20; count++) {
    const start = lower.indexOf('url(', position);
    if (start < 0) break;
    const close = src.indexOf(')', start + 4);
    if (close < 0) break;
    position = close + 1;
    const raw = src
      .slice(start + 4, close)
      .trim()
      .replace(/^["']|["']$/g, '');
    const href = resolveHttps(raw, base);
    const format = /^\s{0,8}format\(\s{0,8}["']?([^"')]{1,30})/i.exec(
      src.slice(position, position + 80),
    );
    const kind = (format?.[1] ?? raw.split('?')[0]?.split('.').pop() ?? '').toLowerCase();
    const rank = Object.hasOwn(RANK, kind) ? (RANK[kind] ?? 50) : 50;
    if (href && rank < bestRank) {
      best = href;
      bestRank = rank;
    }
  }
  return best;
}

function coversLatin(range: string): boolean {
  if (!range) return true;
  return range.split(',').some((part) => {
    const match = /^u\+([0-9a-f?]+)(?:-([0-9a-f]+))?$/i.exec(part.trim());
    if (!match) return false;
    const text = match[1] ?? '';
    const wild = text.includes('?');
    const low = Number.parseInt(text.replace(/\?/g, '0'), 16);
    const high = wild
      ? Number.parseInt(text.replace(/\?/g, 'f'), 16)
      : match[2]
        ? Number.parseInt(match[2], 16)
        : low;
    return [0x41, 0x61].some((point) => point >= low && point <= high);
  });
}

export function scanCss(source: string, base: string): ScannedCss {
  const css = stripComments(source.slice(0, MAX_CSS));
  const lower = asciiLower(css);
  const faces: ScannedCss['faces'] = [];
  const rules: ScannedRule[] = [];
  const imports: string[] = [];

  let position = 0;
  for (let count = 0; count < MAX_STARTS && imports.length < MAX_SHEETS; count++) {
    const start = lower.indexOf('@import', position);
    if (start < 0) break;
    position = start + 7;
    const match = /\s*(?:url\(\s*["']?([^"')]+)["']?\s*\)|["']([^"']+)["'])/y;
    match.lastIndex = 0;
    const found = match.exec(css.slice(position, position + MAX_TAG));
    const href = found?.[1] ?? found?.[2];
    const resolved = href ? resolveHttps(href, base) : '';
    if (resolved) imports.push(resolved);
  }

  position = 0;
  for (let count = 0; count < MAX_STARTS && rules.length < MAX_RULES; count++) {
    const start = lower.indexOf('@font-face', position);
    if (start < 0) break;
    let cursor = start + 10;
    while (cursor < css.length && /\s/.test(css[cursor] ?? '')) cursor++;
    if (css[cursor] !== '{') {
      position = start + 10;
      continue;
    }
    const end = css.indexOf('}', cursor + 1);
    if (end < 0) break;
    position = end + 1;
    const values = declarations(css.slice(cursor + 1, end));
    const family = unquote(values.get('font-family') ?? '').slice(0, 200);
    if (!family) continue;
    const range = (values.get('unicode-range') ?? '').slice(0, MAX_RANGE);
    const weight = (values.get('font-weight') ?? '').slice(0, 20);
    const style = /italic|oblique/i.test(values.get('font-style') ?? '') ? 'italic' : 'normal';
    rules.push({ family, weight, style, ...(range ? { unicodeRange: range } : {}) });
    const url = bestUrl(values.get('src') ?? '', base);
    faces.push({
      face: { family, weight: weightOf(weight), style, ...(url ? { url } : {}) },
      latin: coversLatin(range),
    });
  }
  return { faces, rules, imports };
}

export function mergeFaces(parts: ScannedCss['faces']): ScannedFace[] {
  const slots = new Map<string, number>();
  const result: { face: ScannedFace; latin: boolean }[] = [];
  for (const part of parts) {
    const key = `${part.face.family.toLowerCase()}|${part.face.weight}|${part.face.style}`;
    const slot = slots.get(key);
    if (slot === undefined) {
      if (result.length >= MAX_FACES) continue;
      slots.set(key, result.length);
      result.push(part);
    } else if (part.latin && !result[slot]?.latin) {
      result[slot] = part;
    }
  }
  return result.map((part) => part.face);
}
