import { quoteName } from './css';
import { CssExportError } from './model';

export interface SelfHostFont {
  family: string;
  fileName: string;
  weight: number;
  style: 'normal' | 'italic';
}

const FORMATS: Record<string, string> = {
  woff2: 'woff2',
  woff: 'woff',
  ttf: 'truetype',
  otf: 'opentype',
};

const isControl = (char: string) => {
  const code = char.charCodeAt(0);
  return code < 32 || code === 127;
};

export const SELF_HOST_BASE = '/fonts/';

export const prependSelfHost = (faces: string, css: string) => (faces ? `${faces}\n\n${css}` : css);

export function selfHostFontFaces(
  fonts: readonly SelfHostFont[],
  basePath: string = SELF_HOST_BASE,
): string {
  const base = basePath.endsWith('/') ? basePath : `${basePath}/`;
  if (!/^[\w./~-]*$/.test(base)) throw new CssExportError('invalid-name');
  const rules = new Set<string>();
  for (const font of fonts) {
    if (!Number.isInteger(font.weight) || font.weight < 1 || font.weight > 1000)
      throw new CssExportError('invalid-weight');
    if (!font.fileName?.isWellFormed() || [...font.fileName].some(isControl))
      throw new CssExportError('invalid-name');
    const format = FORMATS[font.fileName.split('.').pop()?.toLowerCase() ?? ''];
    const url = `${base}${encodeURIComponent(font.fileName)}`;
    rules.add(
      [
        '@font-face {',
        `  font-family: ${quoteName(font.family)};`,
        `  font-style: ${font.style};`,
        `  font-weight: ${font.weight};`,
        '  font-display: swap;',
        `  src: url("${url}")${format ? ` format("${format}")` : ''};`,
        '}',
      ].join('\n'),
    );
  }
  return [...rules].join('\n\n');
}
