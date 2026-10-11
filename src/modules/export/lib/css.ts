import { CssExportError, type FallbackCss, type FallbackCssInput } from './model';

const genericFamilies = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'emoji',
  'math',
  'fangsong',
]);

function quoteName(name: string): string {
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    name.length > 256 ||
    name.includes('\0') ||
    !name.isWellFormed()
  )
    throw new CssExportError('invalid-name');
  let result = '"';
  for (const char of name) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined) throw new CssExportError('invalid-name');
    if (codePoint < 0x20 || codePoint === 0x7f || char === '<')
      result += `\\${codePoint.toString(16)} `;
    else if (char === '"' || char === '\\') result += `\\${char}`;
    else result += char;
  }
  return `${result}"`;
}

const UNICODE_RANGE = /^U\+[0-9A-F]{1,6}(-[0-9A-F]{1,6})?(, U\+[0-9A-F]{1,6}(-[0-9A-F]{1,6})?)*$/;
const MAX_UNICODE_RANGE_LENGTH = 100_000;

function unicodeRange(value: string | undefined): string[] {
  if (value === undefined) return [];
  if (value.length > MAX_UNICODE_RANGE_LENGTH || !UNICODE_RANGE.test(value)) {
    throw new CssExportError('invalid-unicode-range');
  }
  return [`  unicode-range: ${value};`];
}

function percentage(ratio: number, positive = false): string {
  const percent = ratio * 100;
  if (!Number.isFinite(percent) || percent < 0 || percent > 1_000_000)
    throw new CssExportError('invalid-adjustment');
  const rounded = Number(percent.toFixed(4));
  if (positive && rounded === 0) throw new CssExportError('invalid-adjustment');
  return `${rounded}%`;
}

export function generateFallbackCss(input: FallbackCssInput): FallbackCss {
  if (!genericFamilies.has(input.genericFamily)) throw new CssExportError('invalid-generic');
  if (input.fallbacks.length > 32) throw new CssExportError('too-many-faces');
  const families = [quoteName(input.targetFamily)];
  const seen = new Set([input.targetFamily.toLowerCase()]);
  const rules: string[] = [];
  for (const face of input.fallbacks) {
    const family = quoteName(face.family);
    const familyKey = face.family.toLowerCase();
    if (seen.has(familyKey)) throw new CssExportError('duplicate-family');
    seen.add(familyKey);
    if (face.localNames.length === 0 || face.localNames.length > 16)
      throw new CssExportError('invalid-name');
    const localNames = [...new Set(face.localNames.map(quoteName))];
    const { adjustment } = face;
    rules.push(
      [
        '@font-face {',
        `  font-family: ${family};`,
        `  src: ${localNames.map((name) => `local(${name})`).join(', ')};`,
        `  size-adjust: ${percentage(adjustment.sizeAdjust, true)};`,
        `  ascent-override: ${percentage(adjustment.ascentOverride)};`,
        `  descent-override: ${percentage(adjustment.descentOverride)};`,
        `  line-gap-override: ${percentage(adjustment.lineGapOverride)};`,
        ...unicodeRange(face.unicodeRange),
        '}',
      ].join('\n'),
    );
    families.push(family);
  }
  return {
    fontFaces: rules.join('\n\n'),
    fontFamily: `font-family: ${families.join(', ')}, ${input.genericFamily};`,
  };
}
