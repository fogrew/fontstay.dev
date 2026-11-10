export type OsId = 'windows' | 'macos' | 'ios' | 'android' | 'linux' | 'chromeos';
export type StackScript =
  | 'arabic'
  | 'hebrew'
  | 'devanagari'
  | 'bengali'
  | 'tamil'
  | 'thai'
  | 'japanese'
  | 'korean'
  | 'chinese_hans'
  | 'chinese_hant';
export type Category = 'sans-serif' | 'serif' | 'monospace' | 'cursive';
export type ExportFormat =
  | 'css'
  | 'variables'
  | 'tailwind'
  | 'next'
  | 'nuxt'
  | 'astro'
  | 'wordpress'
  | 'fontaine'
  | 'preload'
  | 'loading';
export type FitErrorCode = 'invalid-audience' | 'no-systems' | 'no-fit';
export type FontParseErrorCode =
  | 'too-large'
  | 'invalid-font'
  | 'unsupported-format'
  | 'timeout'
  | 'worker-error'
  | 'busy'
  | 'disposed';

export declare const OS_IDS: readonly OsId[];
export declare const STACK_SCRIPTS: readonly StackScript[];
export declare const CATEGORIES: readonly Category[];
export declare const EXPORT_FORMATS: readonly ExportFormat[];

export interface FontFile {
  /** Name used for the export and in messages, for example `inter.woff2`. */
  fileName: string;
  /** Raw bytes of a WOFF2, WOFF, TTF or OTF file. */
  data: Uint8Array;
}

export interface FitOptions {
  fonts: readonly FontFile[];
  /** Browserslist query, optionally with `os <system>` and `not os <system>` parts. */
  audience?: string;
  /** Restrict the fit to these systems. */
  systems?: readonly OsId[];
  /** Frequency profile of the fit. Default `en`. */
  locale?: 'en' | 'ru';
  /** Generic family of the fallbacks. Default: detected from the font. */
  kind?: Category;
  /** Add `unicode-range` with the glyphs each font covers. */
  unicodeRange?: boolean;
  /** Emit separate faces for other scripts than the primary one. Default `true`. */
  scripts?: boolean;
  /** Scripts whose text gets a `:lang()` rule with system fonts only; skipped for a script the fonts cover. Default none. */
  stackScripts?: readonly StackScript[];
  /** Format of `file`. Default `css`. */
  format?: ExportFormat;
}

export interface ExportFile {
  text: string;
  fileName: string;
  language: 'css' | 'js' | 'ts' | 'html' | 'json';
}

export interface FitFontReport {
  fileName: string;
  family: string;
  kind: Category;
  language: 'en' | 'ru';
  /** Share of the glyph weight that the fallbacks have in common with the font, 0 to 1. */
  coverage: number;
  picks: { system: OsId; share: number; family: string }[];
  fallbackFamilies: string[];
  /** True when the font could not be shaped, so the fit assumes the metrics-only width of the web font. */
  webRatioFailed: boolean;
}

export interface FitOutput {
  /** `@font-face` rules and `font-family` rules, the same text as the `css` export. */
  css: string;
  /** The output in the requested format. */
  file: ExportFile;
  fonts: FitFontReport[];
  /** Audience share of each system, in percent. */
  shares: Partial<Record<OsId, number>>;
  /** Systems that have a fallback fitted. */
  systems: OsId[];
  /** Systems in the audience without any fallback font to fit. */
  uncovered: OsId[];
  audience: { query: string; browsers: number };
}

export declare class FitRunError extends Error {
  readonly code: FitErrorCode;
  constructor(code: FitErrorCode, message: string);
}

export declare class FontParseError extends Error {
  readonly code: FontParseErrorCode;
  constructor(code: FontParseErrorCode);
}

export declare function fit(options: FitOptions): Promise<FitOutput>;
export declare function fitFiles(
  paths: readonly string[],
  options?: Omit<FitOptions, 'fonts'>,
): Promise<FitOutput>;

export interface SplitIssue {
  /** `latin-split`: basic Latin spread over several files; `overlap`: overlapping `unicode-range` values; `late-real-face`: the face with the most glyphs is declared before faces that overlap it. */
  kind: 'latin-split' | 'overlap' | 'late-real-face';
  family: string;
  weight: string;
  style: string;
  /** Zero-based positions of the involved `@font-face` rules. */
  rules: number[];
  /** Affected characters as a `unicode-range` value. */
  characters: string;
  /** Number of affected code points. */
  count: number;
}

export interface FaceAudit {
  file: string;
  /** Number of `@font-face` rules read. */
  rules: number;
  issues: SplitIssue[];
}

/** Audit the `@font-face` rules of CSS text for badly split web fonts. */
export declare function auditFontFaces(css: string, file?: string): FaceAudit;
/** Audit CSS files; reads at most 14 MB per file. */
export declare function auditCssFiles(paths: readonly string[]): Promise<FaceAudit[]>;
/** One-line English description of an issue. Rule numbers are 1-based. */
export declare function describeIssue(issue: SplitIssue): string;
