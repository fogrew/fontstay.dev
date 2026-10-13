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

const fontQuery = (family: string) =>
  `'${`1em ${JSON.stringify(family)}`.replace(/[\\']/g, '\\$&')}'`;

export function loadingScript(families: string | readonly string[]): string {
  const list = typeof families === 'string' ? [families] : families;
  const [only] = list;
  const wait =
    list.length === 1 && only !== undefined
      ? `document.fonts.load(${fontQuery(only)})`
      : `Promise.all([${list.map((family) => `document.fonts.load(${fontQuery(family)})`).join(', ')}])`;
  return `const root = document.documentElement;
const done = () => root.classList.remove('${LOADING_CLASS}');
root.classList.add('${LOADING_CLASS}');
${wait}.then(done, done);`;
}
