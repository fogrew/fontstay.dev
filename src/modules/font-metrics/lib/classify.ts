import type { FontCategory } from './model';

const SANS_SERIF_STYLES = new Set([11, 12, 13, 14, 15]);
const SERIF_FAMILY_CLASSES = new Set([1, 2, 3, 4, 5, 7]);
const LATIN_TEXT = 2;
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

export function classifyFont(input: {
  panose: readonly number[] | undefined;
  familyClass: number | undefined;
  monospaced: boolean;
}): FontCategory | null {
  if (input.monospaced) return 'monospace';
  const [kind, serifStyle] = input.panose ?? [];
  if (kind === LATIN_TEXT && serifStyle !== undefined && serifStyle > 1) {
    return SANS_SERIF_STYLES.has(serifStyle) ? 'sans-serif' : 'serif';
  }
  const familyClass = (input.familyClass ?? 0) >> 8;
  if (SERIF_FAMILY_CLASSES.has(familyClass)) return 'serif';
  return familyClass === SANS_FAMILY_CLASS ? 'sans-serif' : null;
}
