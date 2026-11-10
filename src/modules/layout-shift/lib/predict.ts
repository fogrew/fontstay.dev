import { type Block, BODY_PADDING, styleOf } from './document';
import {
  type Box,
  layoutShiftScore,
  MAX_ELEMENTS,
  type Viewport,
  type ViewportResult,
} from './score';

export interface PredictFont {
  unitsPerEm: number;
  codePoints: ArrayLike<number>;
  advances: ArrayLike<number>;
  scale: number;
  ascent: number;
  descent: number;
  lineGap: number;
  letterEm: number;
  wordEm: number;
  lineHeightEm?: number | undefined;
}

export interface Layout {
  boxes: Box[];
  lines: number[];
  height: number;
}

const WIDTH_EPSILON = 0.01;

interface Table {
  widths: Map<number, number>;
  fallback: number;
}

const tables = new WeakMap<object, Table>();
const webLayouts = new WeakMap<PredictFont, WeakMap<readonly Block[], Map<number, Layout>>>();

function tableOf(font: PredictFont): Table {
  const key = font.advances as object;
  const cached = tables.get(key);
  if (cached) return cached;
  const widths = new Map<number, number>();
  let total = 0;
  for (let index = 0; index < font.codePoints.length; index++) {
    const advance = font.advances[index] ?? 0;
    widths.set(font.codePoints[index] ?? 0, advance);
    total += advance;
  }
  const table = {
    widths,
    fallback: font.codePoints.length > 0 ? total / font.codePoints.length : font.unitsPerEm / 2,
  };
  tables.set(key, table);
  return table;
}

class Metrics {
  private readonly widths: Map<number, number>;
  private readonly fallback: number;

  constructor(private readonly font: PredictFont) {
    const table = tableOf(font);
    this.widths = table.widths;
    this.fallback = table.fallback;
  }

  glyph(codePoint: number, fontPx: number): number {
    const advance = this.widths.get(codePoint) ?? this.fallback;
    return (advance / this.font.unitsPerEm) * fontPx * this.font.scale;
  }

  word(text: string, fontPx: number): number {
    let width = 0;
    for (const char of text) {
      width += this.glyph(char.codePointAt(0) ?? 0, fontPx) + this.font.letterEm * fontPx;
    }
    return width;
  }

  space(fontPx: number): number {
    return this.glyph(0x20, fontPx) + (this.font.letterEm + this.font.wordEm) * fontPx;
  }

  lineHeight(fontPx: number, fixedEm?: number): number {
    if (fixedEm !== undefined) return fixedEm * fontPx;
    if (this.font.lineHeightEm !== undefined) return this.font.lineHeightEm * fontPx;
    const { ascent, descent, lineGap } = this.font;
    return (
      Math.round(ascent * fontPx) + Math.round(descent * fontPx) + Math.round(lineGap * fontPx)
    );
  }
}

export function textWidth(font: PredictFont, text: string, fontPx = 16): number {
  const metrics = new Metrics(font);
  const words = text.split(/\s+/).filter(Boolean);
  const space = metrics.space(fontPx);
  return (
    words.reduce((sum, word) => sum + metrics.word(word, fontPx), 0) +
    Math.max(0, words.length - 1) * space
  );
}

export function wrapLines(words: readonly number[], space: number, available: number): number {
  if (words.length === 0) return 1;
  let lines = 1;
  let used = 0;
  for (const [index, width] of words.entries()) {
    if (index === 0) {
      used = width;
    } else if (used + space + width <= available + WIDTH_EPSILON) {
      used += space + width;
    } else {
      lines += 1;
      used = width;
    }
  }
  return lines;
}

export function layoutDocument(
  font: PredictFont,
  blocks: readonly Block[],
  viewportWidth: number,
): Layout {
  if (blocks.length > MAX_ELEMENTS) throw new RangeError('Too many blocks');
  const metrics = new Metrics(font);
  const boxes: Box[] = [];
  const lines: number[] = [];
  let bottom = BODY_PADDING;
  let previousMargin: number | null = null;
  for (const block of blocks) {
    const style = styleOf(block);
    const room = viewportWidth - 2 * BODY_PADDING - style.indent;
    const outer = style.maxWidth === undefined ? room : Math.min(room, style.maxWidth);
    const available = Math.max(1, outer - 2 * style.padX);
    const words = block.text
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => metrics.word(word, style.fontPx));
    const space = metrics.space(style.fontPx);
    const count = wrapLines(words, space, available);
    const lineHeight = metrics.lineHeight(style.fontPx, style.lineHeightEm);
    const naturalWidth =
      words.reduce((sum, width) => sum + width, 0) + Math.max(0, words.length - 1) * space;
    const width = style.fitContent ? Math.min(naturalWidth, available) + 2 * style.padX : outer;
    const gap =
      previousMargin === null ? style.marginTop : Math.max(previousMargin, style.marginTop);
    const top = bottom + gap;
    const height = count * lineHeight + 2 * style.padY;
    boxes.push({ x: BODY_PADDING + style.indent, y: top, width, height });
    lines.push(count);
    bottom = top + height;
    previousMargin = style.marginBottom;
  }
  return { boxes, lines, height: bottom + (previousMargin ?? 0) + BODY_PADDING };
}

function cachedLayout(font: PredictFont, blocks: readonly Block[], width: number): Layout {
  let byBlocks = webLayouts.get(font);
  if (!byBlocks) {
    byBlocks = new WeakMap();
    webLayouts.set(font, byBlocks);
  }
  let byWidth = byBlocks.get(blocks);
  if (!byWidth) {
    byWidth = new Map();
    byBlocks.set(blocks, byWidth);
  }
  const cached = byWidth.get(width);
  if (cached) return cached;
  const layout = layoutDocument(font, blocks, width);
  byWidth.set(width, layout);
  return layout;
}

export function predictViewport(
  web: PredictFont,
  fallback: PredictFont,
  blocks: readonly Block[],
  viewport: Viewport,
): ViewportResult {
  const before = layoutDocument(fallback, blocks, viewport.width);
  const after = cachedLayout(web, blocks, viewport.width);
  const items = before.boxes.map((box, index) => ({
    before: box,
    after: after.boxes[index] as Box,
  }));
  const shift = layoutShiftScore(items, viewport);
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  return {
    viewport,
    score: shift.score,
    impactFraction: shift.impactFraction,
    distanceFraction: shift.distanceFraction,
    shiftedElements: shift.shifted,
    linesBefore: sum(before.lines),
    linesAfter: sum(after.lines),
    heightBefore: before.height,
    heightAfter: after.height,
    lineBreakMismatches: before.lines.filter((count, index) => count !== after.lines[index]).length,
  };
}
