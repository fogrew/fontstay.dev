import type { FontCategory } from './model';

const SANS_SERIF_STYLES = new Set([11, 12, 13, 14, 15]);
const SERIF_FAMILY_CLASSES = new Set([1, 2, 3, 4, 5, 7]);
const LATIN_TEXT = 2;
const LATIN_HAND_WRITTEN = 3;
const SCRIPT_FAMILY_CLASS = 10;
const SANS_FAMILY_CLASS = 8;
const MIN_PROBE_GLYPHS = 20;

function probe(codePoints: ArrayLike<number>, advances: ArrayLike<number>): number[] {
  const result: number[] = [];
  for (let index = 0; index < codePoints.length; index++) {
    const point = codePoints[index] ?? 0;
    const isLetterOrDigit =
      (point >= 0x30 && point <= 0x39) ||
      (point >= 0x41 && point <= 0x5a) ||
      (point >= 0x61 && point <= 0x7a);
    if (isLetterOrDigit) result.push(advances[index] ?? 0);
  }
  return result;
}

export function isMonospaced(codePoints: ArrayLike<number>, advances: ArrayLike<number>): boolean {
  const widths = probe(codePoints, advances);
  return widths.length >= MIN_PROBE_GLYPHS && widths.every((width) => width === widths[0]);
}

const MONO_WORDS = new Set(['mono', 'monospace', 'monospaced', 'code', 'courier', 'typewriter']);
const SANS_WORDS = new Set(['sans', 'grotesk', 'grotesque', 'gothic']);
const SERIF_WORDS = new Set(['serif', 'slab', 'antiqua', 'garamond', 'didone', 'mincho']);
const CURSIVE_WORDS = new Set(['script', 'hand', 'handwriting', 'handwritten', 'brush', 'marker']);

function words(names: readonly (string | null)[]): string[] {
  return names
    .flatMap((name) => (name ?? '').replace(/([a-z])([A-Z])/g, '$1 $2').split(/[^A-Za-z]+/))
    .map((word) => word.toLowerCase())
    .filter(Boolean);
}

export function categoryFromNames(names: readonly (string | null)[]): FontCategory | null {
  const list = words(names);
  if (list.some((word) => MONO_WORDS.has(word))) return 'monospace';
  if (list.some((word) => SANS_WORDS.has(word))) return 'sans-serif';
  return list.some((word) => SERIF_WORDS.has(word)) ? 'serif' : null;
}

function isCursiveName(names: readonly (string | null)[]): boolean {
  return words(names).some((word) => CURSIVE_WORDS.has(word));
}

export function classifyFont(input: {
  panose: readonly number[] | undefined;
  familyClass: number | undefined;
  monospaced: boolean;
  names?: readonly (string | null)[];
}): FontCategory | null {
  if (input.monospaced) return 'monospace';
  const [kind, serifStyle] = input.panose ?? [];
  const familyClass = (input.familyClass ?? 0) >> 8;
  if (kind === LATIN_HAND_WRITTEN || familyClass === SCRIPT_FAMILY_CLASS) return 'cursive';
  const named = categoryFromNames(input.names ?? []);
  if (named) return named;
  if (kind === LATIN_TEXT && serifStyle !== undefined && serifStyle > 1) {
    return SANS_SERIF_STYLES.has(serifStyle) ? 'sans-serif' : 'serif';
  }
  if (SERIF_FAMILY_CLASSES.has(familyClass)) return 'serif';
  if (familyClass === SANS_FAMILY_CLASS) return 'sans-serif';
  return isCursiveName(input.names ?? []) ? 'cursive' : null;
}
