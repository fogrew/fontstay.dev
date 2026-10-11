import raw from '../data/metrics.json';

export interface MetricsSource {
  kind: 'local' | 'download';
  file: string;
  sha256: string;
  url?: string;
  license?: string;
}

export type StyleVariant = 'bold' | 'italic' | 'bold-italic';

export interface FaceMetrics {
  localNames: string[];
  unitsPerEm: number;
  hhea: { ascent: number; descent: number; lineGap: number };
  typo: { ascent: number; descent: number; lineGap: number; useTypoMetrics: boolean } | null;
  win: { ascent: number; descent: number } | null;
  codePoints: Uint32Array;
  advances: Float64Array;
  source: MetricsSource;
}

export interface OsFontMetrics extends FaceMetrics {
  id: string;
  family: string;
  isVariable: boolean;
  variants: Partial<Record<StyleVariant, FaceMetrics>>;
}

interface RawFace {
  source: MetricsSource;
  localNames: string[];
  unitsPerEm: number;
  hhea: FaceMetrics['hhea'];
  typo: FaceMetrics['typo'];
  win: FaceMetrics['win'];
  codePoints: number[];
  advances: number[];
}

interface RawMetrics extends RawFace {
  id: string;
  family: string;
  isVariable: boolean;
  variants?: Partial<Record<StyleVariant, RawFace>>;
}

function decodeFace(id: string, entry: RawFace): FaceMetrics {
  const points: number[] = [];
  for (let index = 0; index + 1 < entry.codePoints.length; index += 2) {
    const start = entry.codePoints[index] ?? 0;
    const length = entry.codePoints[index + 1] ?? 0;
    for (let offset = 0; offset < length; offset++) points.push(start + offset);
  }
  if (points.length !== entry.advances.length) {
    throw new Error(`Metrics for ${id}: code points and advances differ in length`);
  }
  return {
    localNames: entry.localNames,
    unitsPerEm: entry.unitsPerEm,
    hhea: entry.hhea,
    typo: entry.typo,
    win: entry.win,
    codePoints: Uint32Array.from(points),
    advances: Float64Array.from(entry.advances),
    source: entry.source,
  };
}

export function decodeMetrics(entry: RawMetrics): OsFontMetrics {
  const variants: OsFontMetrics['variants'] = {};
  for (const [style, face] of Object.entries(entry.variants ?? {}) as [StyleVariant, RawFace][]) {
    variants[style] = decodeFace(`${entry.id} ${style}`, face);
  }
  return {
    ...decodeFace(entry.id, entry),
    id: entry.id,
    family: entry.family,
    isVariable: entry.isVariable,
    variants,
  };
}

let decoded: OsFontMetrics[] | undefined;

export function osFontMetrics(): readonly OsFontMetrics[] {
  decoded ??= (raw as { fonts: RawMetrics[] }).fonts.map(decodeMetrics);
  return decoded;
}
