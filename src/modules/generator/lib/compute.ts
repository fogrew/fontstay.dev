import { FitError } from '@/modules/fallback-fit';
import type { FontMetrics } from '@/modules/font-metrics';

export function isNoCoverage(error: unknown): boolean {
  return error instanceof FitError && error.code === 'no-shared-glyphs';
}

export const LOW_COVERAGE = 0.9;

const SAMPLE_COVERAGE = 0.8;
const CYRILLIC_PROBE = 'абвгдежзийклмнопрстуфхцчшщъыьэюя';

export function covers(web: Pick<FontMetrics, 'codePoints'>, text: string): boolean {
  const covered = new Set(web.codePoints);
  const letters = [...text].filter((char) => char.trim() !== '');
  const present = letters.filter((char) => covered.has(char.codePointAt(0) ?? -1)).length;
  return letters.length === 0 || present / letters.length >= SAMPLE_COVERAGE;
}

const LATIN_PROBE = 'abcdefghijklmnopqrstuvwxyz';

export function isScriptPair(
  a: Pick<FontMetrics, 'codePoints'>,
  b: Pick<FontMetrics, 'codePoints'>,
  probe: string,
): boolean {
  return covers(a, probe) !== covers(b, probe) && covers(a, LATIN_PROBE) !== covers(b, LATIN_PROBE);
}

export function uncoveredFamilies(
  fonts: readonly { fileName: string; metrics: Pick<FontMetrics, 'codePoints' | 'names'> }[],
  probe: string,
): string[] {
  const families = new Map<string, boolean>();
  for (const { fileName, metrics } of fonts) {
    const name = metrics.names.family?.trim().slice(0, 200) || fileName;
    families.set(name, families.get(name) === true || covers(metrics, probe));
  }
  return [...families].filter(([, covered]) => !covered).map(([name]) => name);
}

export function fitLanguage(web: Pick<FontMetrics, 'codePoints'> | undefined, locale: string) {
  return locale === 'ru' && web && covers(web, CYRILLIC_PROBE) ? 'ru' : 'en';
}

export function sampleText(web: FontMetrics, preferred: string): string {
  if (covers(web, preferred)) return preferred;
  const own = [...web.codePoints]
    .map((codePoint) => String.fromCodePoint(codePoint))
    .filter((char) => /\p{L}|\p{N}/u.test(char));
  const pool = own.length > 0 ? own : [...web.codePoints].map((cp) => String.fromCodePoint(cp));
  const chunks: string[] = [];
  for (let index = 0; index < Math.min(pool.length, 40); index += 8) {
    chunks.push(pool.slice(index, index + 8).join(''));
  }
  return chunks.join(' ') || preferred;
}

const BIDI_CONTROLS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

export function displayName(name: string): string {
  return name.replace(BIDI_CONTROLS, '');
}
