import { basename } from 'node:path';
import { buildExport, EXPORT_FORMATS, type ExportFile, type ExportFormat } from '@/modules/export';
import { FontParseError, type FontParseErrorCode } from '@/modules/font-metrics';
// Deep imports: exporting these from the module barrels would add them to the site's initial JavaScript.
import { parseFontBuffer } from '@/modules/font-metrics/lib/parse';
import {
  type FitErrorCode,
  type FitFontReport,
  FitRunError,
  fitFonts,
} from '@/modules/generator/lib/fit-fonts';
import { CATEGORIES, type Category, OS_IDS, type OsId } from '@/modules/os-fonts';
import { arrayBufferOf, readFont } from './read-font';

export type {
  Category,
  ExportFile,
  ExportFormat,
  FitErrorCode,
  FitFontReport,
  FontParseErrorCode,
  OsId,
};
export { CATEGORIES, EXPORT_FORMATS, FitRunError, FontParseError, OS_IDS };

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
