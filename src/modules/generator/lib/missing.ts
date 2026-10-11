export interface TextRun {
  text: string;
  covered: boolean;
}

const INVISIBLE = /^[\p{Z}\p{C}\p{M}]$/u;

export function textRuns(text: string, codePoints: ArrayLike<number>): TextRun[] {
  const covered = new Set<number>(Array.from(codePoints));
  const runs: TextRun[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    const isCovered = covered.has(code) || INVISIBLE.test(char);
    const last = runs[runs.length - 1];
    if (last && last.covered === isCovered) last.text += char;
    else runs.push({ text: char, covered: isCovered });
  }
  return runs;
}

export function missingCharacters(runs: readonly TextRun[]): string[] {
  const seen = new Set<string>();
  for (const run of runs) {
    if (run.covered) continue;
    for (const char of run.text) seen.add(char);
  }
  return [...seen];
}

export function codePointLabel(char: string): string {
  return `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`;
}
