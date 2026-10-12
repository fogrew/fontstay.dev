export interface SpacingEm {
  letter: number;
  word: number;
}

export const LOADING_CLASS = 'fonts-loading';

const trimmed = (value: number) => Number.parseFloat(value.toFixed(4)).toString();

export function hasSpacing(spacing: SpacingEm): boolean {
  return Math.abs(spacing.letter) >= 0.00005 || Math.abs(spacing.word) >= 0.00005;
}

export function loadingCss(spacing: SpacingEm): string {
  if (!hasSpacing(spacing)) return '';
  const lines = [
    Math.abs(spacing.letter) >= 0.00005 ? `  letter-spacing: ${trimmed(spacing.letter)}em;` : '',
    Math.abs(spacing.word) >= 0.00005 ? `  word-spacing: ${trimmed(spacing.word)}em;` : '',
  ].filter(Boolean);
  return `.${LOADING_CLASS} {\n${lines.join('\n')}\n}`;
}

export function loadingScript(family: string): string {
  const font = `'${`1em ${JSON.stringify(family)}`.replace(/[\\']/g, '\\$&')}'`;
  return `const root = document.documentElement;
const done = () => root.classList.remove('${LOADING_CLASS}');
root.classList.add('${LOADING_CLASS}');
document.fonts.load(${font}).then(done, done);`;
}
