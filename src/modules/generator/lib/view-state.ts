import { finite, isRecord, oneOf } from './guard';
import { GUIDES, type GuideId } from './guides';
import { PRESET_IDS, type Preset } from './layers';

export const WRAPS = ['wrap', 'balance', 'pretty', 'stable', 'nowrap'] as const;
export type Wrap = (typeof WRAPS)[number];
export const SUBSTITUTES = ['sans-serif', 'serif', 'monospace', 'cursive', 'system-ui'] as const;
export type Substitute = (typeof SUBSTITUTES)[number];
export const LENS_SHOWS = ['overlay', 'web', 'fallback', 'plain'] as const;
export type LensShows = (typeof LENS_SHOWS)[number];
export const RENDERS = ['fill', 'outline'] as const;
export type Render = (typeof RENDERS)[number];
export const COLORS = ['text', 'green', 'red', 'blue', 'amber'] as const;
export type LayerColor = (typeof COLORS)[number];
export const LAYER_KINDS = ['web', 'fallback'] as const;
export type LayerKind = (typeof LAYER_KINDS)[number];

export const TEXT_LEVELS = [
  'title',
  'heading',
  'subheading',
  'kicker',
  'lead',
  'body',
  'quote',
  'small',
  'code',
] as const;
export type TextLevel = (typeof TEXT_LEVELS)[number];
export const LEVEL_SIZE = { min: 8, max: 96 };
export const BODY_SIZE = { min: 12, max: 32 };
export const LINE_HEIGHT = { min: 1, max: 2.4 };

export interface LevelStyle {
  size?: number | undefined;
  lineHeight?: number | undefined;
  wrap?: Wrap | undefined;
}
export type LevelStyles = Partial<Record<TextLevel, LevelStyle>>;

export interface LayerStyle {
  render: Render;
  color: LayerColor;
  width: number;
  opacity: number;
}

export const DEFAULT_LAYERS: Record<LayerKind, LayerStyle> = {
  web: { render: 'fill', color: 'text', width: 1, opacity: 100 },
  fallback: { render: 'outline', color: 'green', width: 1, opacity: 100 },
};

export interface PreviewView {
  mode: Preset;
  stacked: boolean;
  xray: boolean;
  lensShows?: LensShows | undefined;
  lensSize: number;
  guides: GuideId[];
  boxes: boolean;
  size: number;
  lineHeight: number;
  wrap: Wrap;
  levels: LevelStyles;
  substitute: Substitute;
  headingFont?: string | undefined;
  bodyFont?: string | undefined;
  layers: Record<LayerKind, LayerStyle>;
  split: number;
  frame?: number | undefined;
}

export interface ViewDiff {
  mode?: Preset;
  stacked?: boolean;
  xray?: boolean;
  lensShows?: LensShows;
  lensSize?: number;
  guides?: GuideId[];
  boxes?: boolean;
  size?: number;
  lineHeight?: number;
  wrap?: Wrap;
  levels?: LevelStyles;
  substitute?: Substitute;
  headingFont?: string;
  bodyFont?: string;
  layers?: Partial<Record<LayerKind, Partial<LayerStyle>>>;
  split?: number;
  frame?: number;
}

const MAX_FONT_NAME = 200;

const COMPARISONS: readonly Preset[] = ['slider', 'overlay', 'side'];

export function lensDefault(mode: Preset): LensShows {
  if (COMPARISONS.includes(mode)) return 'fallback';
  return mode === 'web' ? 'fallback' : 'web';
}

export function defaultView(): PreviewView {
  return {
    mode: 'slider',
    stacked: false,
    xray: true,
    lensSize: 200,
    guides: [],
    boxes: false,
    size: 18,
    lineHeight: 1.5,
    wrap: 'wrap',
    levels: {},
    substitute: 'sans-serif',
    layers: DEFAULT_LAYERS,
    split: 50,
  };
}

const LAYER_KEYS = ['render', 'color', 'width', 'opacity'] as const;
const SCALAR_KEYS = [
  'mode',
  'stacked',
  'xray',
  'lensShows',
  'lensSize',
  'boxes',
  'size',
  'lineHeight',
  'wrap',
  'substitute',
  'headingFont',
  'bodyFont',
  'split',
  'frame',
] as const;

const sameGuides = (a: readonly GuideId[], b: readonly GuideId[]) =>
  a.length === b.length && a.every((id, index) => id === b[index]);

export function diffView(view: PreviewView, base: PreviewView): ViewDiff {
  const diff: Record<string, unknown> = {};
  for (const key of SCALAR_KEYS) {
    if (view[key] !== base[key] && view[key] !== undefined) diff[key] = view[key];
  }
  if (!sameGuides(view.guides, base.guides)) diff.guides = view.guides;
  if (JSON.stringify(view.levels) !== JSON.stringify(base.levels)) diff.levels = view.levels;
  const layers: NonNullable<ViewDiff['layers']> = {};
  for (const kind of LAYER_KINDS) {
    const changed: Record<string, unknown> = {};
    for (const key of LAYER_KEYS) {
      if (view.layers[kind][key] !== base.layers[kind][key]) {
        changed[key] = view.layers[kind][key];
      }
    }
    if (Object.keys(changed).length > 0) layers[kind] = changed;
  }
  if (Object.keys(layers).length > 0) diff.layers = layers;
  return diff;
}

export function applyView(base: PreviewView, diff: ViewDiff): PreviewView {
  const layers = { ...base.layers };
  for (const kind of LAYER_KINDS) layers[kind] = { ...base.layers[kind], ...diff.layers?.[kind] };
  const { guides, layers: _layers, ...scalars } = diff;
  return { ...base, ...scalars, guides: guides ?? base.guides, layers };
}

function parseFont(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_FONT_NAME
    ? value
    : undefined;
}

function parseLevel(level: TextLevel, raw: unknown): LevelStyle | undefined {
  if (!isRecord(raw)) return undefined;
  const style: LevelStyle = {};
  // body size and line height are the view's own `size` and `lineHeight`
  if (level !== 'body') {
    if (finite(raw.size, LEVEL_SIZE.min, LEVEL_SIZE.max)) style.size = raw.size;
    if (finite(raw.lineHeight, LINE_HEIGHT.min, LINE_HEIGHT.max)) style.lineHeight = raw.lineHeight;
  }
  const wrap = oneOf(WRAPS, raw.wrap);
  if (wrap) style.wrap = wrap;
  return Object.keys(style).length > 0 ? style : undefined;
}

function parseLevels(raw: unknown): LevelStyles | undefined {
  if (!isRecord(raw)) return undefined;
  const levels: LevelStyles = {};
  for (const level of TEXT_LEVELS) {
    const style = parseLevel(level, raw[level]);
    if (style) levels[level] = style;
  }
  return Object.keys(levels).length > 0 ? levels : undefined;
}

function parseLayer(raw: unknown): Partial<LayerStyle> | undefined {
  if (!isRecord(raw)) return undefined;
  const layer: Partial<LayerStyle> = {};
  const render = oneOf(RENDERS, raw.render);
  if (render) layer.render = render;
  const color = oneOf(COLORS, raw.color);
  if (color) layer.color = color;
  if (finite(raw.width, 0.5, 4)) layer.width = raw.width;
  if (finite(raw.opacity, 0, 100)) layer.opacity = raw.opacity;
  return layer;
}

export function parseViewDiff(raw: unknown): ViewDiff | undefined {
  if (!isRecord(raw)) return undefined;
  const view: ViewDiff = {};
  const mode = oneOf(PRESET_IDS, raw.mode);
  if (mode) view.mode = mode;
  if (typeof raw.stacked === 'boolean') view.stacked = raw.stacked;
  if (typeof raw.xray === 'boolean') view.xray = raw.xray;
  const lensShows = oneOf(LENS_SHOWS, raw.lensShows);
  if (lensShows) view.lensShows = lensShows;
  if (finite(raw.lensSize, 80, 400)) view.lensSize = raw.lensSize;
  if (Array.isArray(raw.guides)) {
    const guides = GUIDES.filter((id) => (raw.guides as unknown[]).includes(id));
    if (guides.length > 0) view.guides = guides;
  }
  if (typeof raw.boxes === 'boolean') view.boxes = raw.boxes;
  if (finite(raw.size, BODY_SIZE.min, BODY_SIZE.max)) view.size = raw.size;
  if (finite(raw.lineHeight, LINE_HEIGHT.min, LINE_HEIGHT.max)) view.lineHeight = raw.lineHeight;
  const wrap = oneOf(WRAPS, raw.wrap);
  if (wrap) view.wrap = wrap;
  const levels = parseLevels(raw.levels);
  if (levels) view.levels = levels;
  const substitute = oneOf(SUBSTITUTES, raw.substitute);
  if (substitute) view.substitute = substitute;
  const headingFont = parseFont(raw.headingFont);
  if (headingFont) view.headingFont = headingFont;
  const bodyFont = parseFont(raw.bodyFont);
  if (bodyFont) view.bodyFont = bodyFont;
  if (isRecord(raw.layers)) {
    const layers: NonNullable<ViewDiff['layers']> = {};
    for (const kind of LAYER_KINDS) {
      const layer = parseLayer(raw.layers[kind]);
      if (layer && Object.keys(layer).length > 0) layers[kind] = layer;
    }
    if (Object.keys(layers).length > 0) view.layers = layers;
  }
  if (finite(raw.split, 0, 100)) view.split = raw.split;
  if (finite(raw.frame, 320, 10_000)) view.frame = Math.round(raw.frame);
  return view;
}
