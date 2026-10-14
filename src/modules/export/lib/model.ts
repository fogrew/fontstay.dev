export type GenericFamily =
  | 'serif'
  | 'sans-serif'
  | 'monospace'
  | 'cursive'
  | 'fantasy'
  | 'system-ui'
  | 'ui-serif'
  | 'ui-sans-serif'
  | 'ui-monospace'
  | 'ui-rounded'
  | 'emoji'
  | 'math'
  | 'fangsong';

export interface CssAdjustment {
  sizeAdjust: number;
  ascentOverride: number;
  descentOverride: number;
  lineGapOverride: number;
}

export interface ScriptFace {
  unicodeRange: string;
  adjustment: CssAdjustment;
}

export interface FallbackFace {
  family: string;
  localNames: readonly string[];
  adjustment: CssAdjustment;
  scripts?: readonly ScriptFace[] | undefined;
  unicodeRange?: string | undefined;
  fontWeight?: number | undefined;
  fontStyle?: 'italic' | undefined;
}

export interface FallbackCssInput {
  targetFamily: string;
  fallbacks: readonly FallbackFace[];
  genericFamily: GenericFamily;
}

export interface FallbackCss {
  fontFaces: string;
  fontFamily: string;
  families: string[];
}

export class CssExportError extends Error {
  constructor(
    public readonly code:
      | 'invalid-name'
      | 'duplicate-family'
      | 'invalid-generic'
      | 'invalid-adjustment'
      | 'invalid-unicode-range'
      | 'invalid-weight'
      | 'too-many-faces',
  ) {
    super(code);
    this.name = 'CssExportError';
  }
}
