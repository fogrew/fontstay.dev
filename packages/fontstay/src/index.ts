import { basename } from 'node:path';
import { buildExport, EXPORT_FORMATS, type ExportFile, type ExportFormat } from '@/modules/export';
import { auditSplitFaces, type SplitIssue } from '@/modules/fallback-fit';
import { FontParseError, type FontParseErrorCode } from '@/modules/font-metrics';
import { parseFontBuffer } from '@/modules/font-metrics/lib/parse';
// Deep imports: exporting these from the module barrels would add them to the site's initial JavaScript.
import { MAX_CSS_CHARS, parseFaceRules } from '@/modules/generator/lib/css-import';
import {
  type FitErrorCode,
  type FitFontReport,
  FitRunError,
  fitFonts,
} from '@/modules/generator/lib/fit-fonts';
import { STACK_SCRIPTS, type StackScript } from '@/modules/generator/lib/script-stacks';
import { CATEGORIES, type Category, OS_IDS, type OsId } from '@/modules/os-fonts';
import { arrayBufferOf, readFont, readText } from './read-font';

export type {
  Category,
  ExportFile,
  ExportFormat,
  FitErrorCode,
  FitFontReport,
  FontParseErrorCode,
  OsId,
  SplitIssue,
  StackScript,
};
export { CATEGORIES, EXPORT_FORMATS, FitRunError, FontParseError, OS_IDS, STACK_SCRIPTS };

export interface FontFile {
  fileName: string;
  data: Uint8Array;
}

export interface FitOptions {
  fonts: readonly FontFile[];
  audience?: string;
  systems?: readonly OsId[];
  locale?: 'en' | 'ru';
  kind?: Category;
  unicodeRange?: boolean;
  scripts?: boolean;
  stackScripts?: readonly StackScript[];
  emoji?: boolean;
  format?: ExportFormat;
}

export interface FitOutput {
  css: string;
  file: ExportFile;
  fonts: FitFontReport[];
  shares: Partial<Record<OsId, number>>;
  systems: OsId[];
  uncovered: OsId[];
  audience: { query: string; browsers: number };
}

export async function fit(options: FitOptions): Promise<FitOutput> {
  if (options.fonts.length === 0) throw new FitRunError('no-fit', 'No font files given.');
  const result = await fitFonts({
    fonts: options.fonts.map((font) => ({
      fileName: font.fileName,
      metrics: parseFontBuffer(arrayBufferOf(font.data)),
      bytes: font.data,
      kind: options.kind,
    })),
    audience: options.audience,
    systems: options.systems,
    locale: options.locale,
    unicodeRange: options.unicodeRange,
    scripts: options.scripts,
    stackScripts: options.stackScripts,
    emoji: options.emoji,
  });
  return {
    css: result.input.css,
    file: buildExport(options.format ?? 'css', result.input),
    fonts: result.fonts,
    shares: result.shares,
    systems: result.systems,
    uncovered: result.uncovered,
    audience: result.audience,
  };
}

export async function fitFiles(
  paths: readonly string[],
  options: Omit<FitOptions, 'fonts'> = {},
): Promise<FitOutput> {
  const fonts: FontFile[] = [];
  for (const path of paths) fonts.push({ fileName: basename(path), data: await readFont(path) });
  return fit({ ...options, fonts });
}

export interface FaceAudit {
  file: string;
  /** Number of `@font-face` rules read; rule numbers in `issues` are 1-based positions among them. */
  rules: number;
  issues: SplitIssue[];
}

export function auditFontFaces(css: string, file = 'css'): FaceAudit {
  const rules = parseFaceRules(css);
  return { file, rules: rules.length, issues: auditSplitFaces(rules) };
}

export async function auditCssFiles(paths: readonly string[]): Promise<FaceAudit[]> {
  const audits: FaceAudit[] = [];
  for (const path of paths)
    audits.push(auditFontFaces(await readText(path, MAX_CSS_CHARS), basename(path)));
  return audits;
}

const rulesOf = (issue: SplitIssue) => issue.rules.map((index) => index + 1).join(', ');

export function describeIssue(issue: SplitIssue): string {
  const face = `${issue.family} ${issue.weight} ${issue.style}`;
  const chars =
    issue.characters.length > 120 ? `${issue.characters.slice(0, 120)}...` : issue.characters;
  if (issue.kind === 'latin-split')
    return `${face}: basic Latin (${chars}) is spread over rules ${rulesOf(issue)}.`;
  if (issue.kind === 'late-real-face') {
    const [first, second] = issue.rules;
    return `${face}: rule ${(first ?? 0) + 1}, which carries the most glyphs, is declared before rule ${(second ?? 0) + 1}, which overlaps it on ${issue.count} characters (${chars}). Consider declaring it last.`;
  }
  return `${face}: rules ${rulesOf(issue)} overlap on ${issue.count} characters (${chars}).`;
}
