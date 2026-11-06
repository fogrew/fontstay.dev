import { JOINING, SHAPING } from './default-on';

export const KNOWN_FEATURES = [
  'aalt',
  'afrc',
  'c2pc',
  'c2sc',
  'calt',
  'case',
  'ccmp',
  'clig',
  'cpsp',
  'curs',
  'cswh',
  'dist',
  'dlig',
  'dnom',
  'dtls',
  'flac',
  'frac',
  'hist',
  'hlig',
  'ital',
  'kern',
  'lfbd',
  'liga',
  'lnum',
  'locl',
  'mark',
  'mkmk',
  'nalt',
  'numr',
  'onum',
  'opbd',
  'ordn',
  'pcap',
  'pnum',
  'rclt',
  'rlig',
  'rtbd',
  'rvrn',
  'salt',
  'sinf',
  'smcp',
  'subs',
  'sups',
  'swsh',
  'titl',
  'tnum',
  'unic',
  'zero',
] as const;
export type KnownFeature = (typeof KNOWN_FEATURES)[number];

export type FeatureKind =
  | { kind: 'known'; tag: KnownFeature }
  | { kind: 'stylistic-set'; number: number }
  | { kind: 'character-variant'; number: number }
  | { kind: 'joining' }
  | { kind: 'shaping' }
  | { kind: 'unknown' };

const KNOWN = new Set<string>(KNOWN_FEATURES);
const STYLISTIC_SET = /^ss(0[1-9]|1\d|20)$/;
const CHARACTER_VARIANT = /^cv(0[1-9]|[1-9]\d)$/;

export function classifyFeature(tag: string): FeatureKind {
  const stylistic = STYLISTIC_SET.exec(tag);
  if (stylistic) return { kind: 'stylistic-set', number: Number(stylistic[1]) };
  const variant = CHARACTER_VARIANT.exec(tag);
  if (variant) return { kind: 'character-variant', number: Number(variant[1]) };
  if (KNOWN.has(tag)) return { kind: 'known', tag: tag as KnownFeature };
  if (JOINING.includes(tag)) return { kind: 'joining' };
  if (SHAPING.includes(tag)) return { kind: 'shaping' };
  return { kind: 'unknown' };
}
