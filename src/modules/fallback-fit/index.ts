export { fitFont, fitFromAverages } from './lib/fit';
export {
  type FitAdjustment,
  FitError,
  type FitFont,
  type FitMetrics,
  type FontFit,
  type GlyphWeight,
  type LineMetrics,
  type MetricsPolicy,
  type MetricsSource,
} from './lib/model';
export { resolveStack } from './lib/stack';
export {
  type PlatformResolution,
  type StackFace,
  type StackPreference,
  type StackResolution,
  StackResolveError,
} from './lib/stack-model';
export { type SystemFont, systemFonts } from './lib/system-fonts';
export {
  type CodePointRange,
  compactRanges,
  countCodePoints,
  expandRanges,
  formatUnicodeRange,
  intersectCount,
  parseUnicodeRange,
  SUBSETS,
  type SubsetCoverage,
  type SubsetName,
  subsetCoverage,
  UnicodeRangeError,
} from './lib/unicode-range';
export { languageWeights } from './lib/weights';
