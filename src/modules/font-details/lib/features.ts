const JOINING = ['init', 'medi', 'fina', 'isol', 'fin2', 'fin3', 'med2'];
const SHAPING = [
  'abvf',
  'abvm',
  'abvs',
  'akhn',
  'blwf',
  'blwm',
  'blws',
  'cfar',
  'cjct',
  'half',
  'haln',
  'nukt',
  'pref',
  'pres',
  'pstf',
  'psts',
  'rkrf',
  'rphf',
  'vatu',
  'ljmo',
  'vjmo',
  'tjmo',
];
const DEFAULT_ON = new Set([
  'ccmp',
  'locl',
  'mark',
  'mkmk',
  'calt',
  'clig',
  'liga',
  'rlig',
  'rclt',
  'rvrn',
  'kern',
  'curs',
  'dist',
  'ltra',
  'ltrm',
  'rtla',
  'rtlm',
  ...JOINING,
  ...SHAPING,
]);

const SAMPLES: Record<string, string> = {
  aalt: 'a g R 1 &',
  c2pc: 'Petite CAPS',
  c2sc: 'Small CAPS',
  case: '(H-A) [Q] {x} ¿?',
  cpsp: 'HOHOHO',
  dlig: 'ct st Th ff',
  dnom: '0123456789',
  frac: '1/2 3/4 5/8 12/25',
  hist: 'sſ History',
  hlig: 'ſt ct',
  kern: 'AVATAR To Wa',
  liga: 'fi fl ffi ffl',
  clig: 'fi fl ffi ffl',
  lnum: '0123456789',
  mark: 'é ñ ǻ ệ',
  mkmk: 'ạ́ ệ ǭ',
  numr: '0123456789',
  onum: '0123456789',
  ordn: '1a 2o Nº 3ª',
  pcap: 'Petite caps',
  pnum: '1111 0000 8888',
  salt: 'Rag Qgy &123',
  sinf: 'H2O CO2',
  smcp: 'Small caps',
  subs: 'H2O CO2',
  sups: 'x2 m3 1st',
  swsh: 'Swash Queen',
  cswh: 'Swash Queen',
  titl: 'Titling',
  tnum: '1111 0000 8888',
  unic: 'Unicase Text',
  zero: '0O 2025',
  ital: 'Italic text',
  nalt: '1 2 3 A B C',
  afrc: '1/2 3/4',
  dtls: 'i j ī',
  flac: 'Áéî',
  opbd: '“Quote” (text)',
  lfbd: '“Quote” (text)',
  rtbd: '“Quote” (text)',
};

export const DEFAULT_SAMPLE = 'Hamburgefonstiv 0123';
export const DEFAULT_PREVIEW = 'Sphinx of black quartz, judge my vow 0123456789';

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

export function isDefaultOn(tag: string): boolean {
  return DEFAULT_ON.has(tag);
}

export function sampleFor(tag: string): string {
  if (STYLISTIC_SET.test(tag) || CHARACTER_VARIANT.test(tag)) return 'Rag Qgy &123';
  return SAMPLES[tag] ?? DEFAULT_SAMPLE;
}

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
