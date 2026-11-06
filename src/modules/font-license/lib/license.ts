export type LicenseKind = 'ofl' | 'apache' | 'mit' | 'ubuntu' | 'cc0' | 'unknown' | 'none';

export type EmbeddingLevel = 'installable' | 'restricted' | 'preview-print' | 'editable';

export interface LicenseInput {
  copyright: string | null;
  trademark: string | null;
  license: string | null;
  licenseUrl: string | null;
  fsType: number | null;
}

export type LicenseNotice =
  | 'restricted'
  | 'no-subsetting'
  | 'bitmap-only'
  | 'reserved-name'
  | 'unknown';

export interface LicenseInfo {
  kind: LicenseKind;
  embedding: EmbeddingLevel | null;
  noSubsetting: boolean;
  bitmapOnly: boolean;
  reservedFontNames: string[];
  hasReservedFontName: boolean;
  conversionBlocked: boolean;
  subsettingBlocked: boolean;
  renameRequired: boolean;
  notices: LicenseNotice[];
}

const KIND_PATTERNS: readonly [Exclude<LicenseKind, 'unknown' | 'none'>, RegExp][] = [
  ['ofl', /open font licen[sc]e|scripts\.sil\.org\/ofl|openfontlicense\.org|\bOFL\b/i],
  ['ubuntu', /ubuntu font licen[sc]e|ubuntu\.com\/legal\/terms-and-policies\/font-licen/i],
  ['apache', /apache licen[sc]e|apache\.org\/licenses/i],
  [
    'mit',
    /\bMIT licen[sc]e|opensource\.org\/licenses?\/MIT|permission is hereby granted, free of charge/i,
  ],
  ['cc0', /\bCC0\b|creativecommons\.org\/publicdomain\/zero|public domain dedication/i],
];

export function licenseKind(license: string | null, licenseUrl: string | null): LicenseKind {
  const text = `${license ?? ''}\n${licenseUrl ?? ''}`;
  if (!text.trim()) return 'none';
  return KIND_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? 'unknown';
}

const RESERVED = /reserved font names?/gi;
const QUOTED = /["“”‘'«]([^"“”‘'»]{1,80})["“”’'»]/g;

export function reservedFontNames(texts: readonly (string | null)[]): {
  present: boolean;
  names: string[];
} {
  const names = new Set<string>();
  let present = false;
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.matchAll(RESERVED)) {
      present = true;
      const tail = text.slice(match.index + match[0].length, match.index + match[0].length + 160);
      const sentence = tail.split(/[.;\n]/)[0] ?? '';
      for (const quoted of sentence.matchAll(QUOTED)) {
        const name = quoted[1]?.trim();
        if (name) names.add(name);
      }
    }
  }
  return { present, names: [...names].slice(0, 8) };
}

const NO_EMBEDDING = 0x0002;
const PREVIEW_PRINT = 0x0004;
const EDITABLE = 0x0008;
const NO_SUBSETTING = 0x0100;
const BITMAP_ONLY = 0x0200;

export function embeddingLevel(fsType: number | null): EmbeddingLevel | null {
  if (fsType === null) return null;
  if (fsType & NO_EMBEDDING) return 'restricted';
  if (fsType & PREVIEW_PRINT) return 'preview-print';
  if (fsType & EDITABLE) return 'editable';
  return 'installable';
}

export function analyzeLicense(input: LicenseInput): LicenseInfo {
  const kind = licenseKind(input.license, input.licenseUrl);
  const embedding = embeddingLevel(input.fsType);
  const noSubsetting = input.fsType !== null && (input.fsType & NO_SUBSETTING) !== 0;
  const bitmapOnly = input.fsType !== null && (input.fsType & BITMAP_ONLY) !== 0;
  const reserved = reservedFontNames([input.copyright, input.license, input.trademark]);
  const conversionBlocked = embedding === 'restricted' || bitmapOnly;
  const subsettingBlocked = conversionBlocked || noSubsetting;
  const renameRequired = !subsettingBlocked && reserved.present && kind === 'ofl';
  const notices: LicenseNotice[] = [];
  if (embedding === 'restricted') notices.push('restricted');
  if (bitmapOnly) notices.push('bitmap-only');
  if (noSubsetting) notices.push('no-subsetting');
  if (reserved.present && kind === 'ofl') notices.push('reserved-name');
  if (kind === 'unknown' || kind === 'none') notices.push('unknown');
  return {
    kind,
    embedding,
    noSubsetting,
    bitmapOnly,
    reservedFontNames: reserved.names,
    hasReservedFontName: reserved.present,
    conversionBlocked,
    subsettingBlocked,
    renameRequired,
    notices,
  };
}
