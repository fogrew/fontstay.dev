export { type BlockCoverage, blockCoverage, type UnicodeBlock, unicodeBlocks } from './lib/blocks';
export { createFontParser, type FontParser } from './lib/client';
export {
  collectionMemberIndices,
  collectionSize,
  extractCollectionMember,
  isFontCollection,
  MAX_COLLECTION_MEMBERS,
} from './lib/collection';
export { emptyFontDetails } from './lib/details';
export { glyphOutline, inspectGlyphs } from './lib/glyph-client';
export {
  GLYPH_EMPTY,
  GLYPH_ENCODED,
  type GlyphAlternate,
  type GlyphTable,
} from './lib/glyph-model';
export {
  FONT_PARSE_TIMEOUT_MS,
  type FontAxis,
  type FontCategory,
  type FontDetails,
  type FontFeature,
  type FontInstance,
  type FontMetrics,
  type FontNames,
  type FontPalettes,
  FontParseError,
  type FontParseErrorCode,
  type FontParseResult,
  type FontStyleInfo,
  type LayoutTable,
  MAX_FONT_BYTES,
  type VerticalMetrics,
} from './lib/model';
