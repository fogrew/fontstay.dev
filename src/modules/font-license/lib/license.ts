import { LICENSE_TEXTS } from './license-texts';

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

export type LicenseBlockReason = 'restricted' | 'bitmap-only' | 'no-subsetting';

export interface LicenseFileMetadata {
  copyright: string | null;
  licenseText: string;
  licenseDescription: string | null;
  licenseUrl: string | null;
}

export interface LicenseInfo {
  kind: LicenseKind;
  embedding: EmbeddingLevel | null;
  noSubsetting: boolean;
  bitmapOnly: boolean;
  reservedFontNames: string[];
  hasReservedFontName: boolean;
  conversionBlocked: boolean;
  subsettingBlocked: boolean;
  conversionBlockReason: LicenseBlockReason | null;
  subsettingBlockReason: LicenseBlockReason | null;
  renameRequired: boolean;
  licenseFile: LicenseFileMetadata | null;
  notices: LicenseNotice[];
}

const MAX_LICENSE_FIELD_LENGTH = 2000;

function bounded(value: string | null): string | null {
  return (
    value
      ?.slice(0, MAX_LICENSE_FIELD_LENGTH)
      .replace(/\r\n?/g, '\n')
      .replace(/[\p{Cc}\p{Cf}]/gu, (char) => (char === '\n' || char === '\t' ? char : '')) ?? null
  );
}

const KIND_PATTERNS: readonly [Exclude<LicenseKind, 'unknown' | 'none'>, RegExp][] = [
  ['ofl', /open font licen[sc]e|\bOFL\b/i],
  ['ubuntu', /ubuntu font licen[sc]e/i],
  ['apache', /apache licen[sc]e/i],
  ['mit', /\bMIT licen[sc]e|permission is hereby granted, free of charge/i],
  ['cc0', /\bCC0\b|public domain dedication/i],
];

function urlLicenseKind(value: string): LicenseKind | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    const path = url.pathname.replace(/\/$/, '').toLowerCase();
    if (host === 'scripts.sil.org' && (path === '/ofl' || path === '/ofl11')) return 'ofl';
    if (host === 'openfontlicense.org') return 'ofl';
    if (host === 'apache.org' && path === '/licenses/license-2.0') return 'apache';
    if (host === 'opensource.org' && (path === '/licenses/mit' || path === '/license/mit'))
      return 'mit';
    if (
      host === 'ubuntu.com' &&
      (path === '/legal/font-licence' || path === '/legal/terms-and-policies/font-licence')
    )
      return 'ubuntu';
    if (host === 'creativecommons.org' && path === '/publicdomain/zero/1.0') return 'cc0';
    if (host === 'spdx.org') {
      const id = path.replace(/\.html$/, '');
      if (id === '/licenses/ofl-1.1') return 'ofl';
      if (id === '/licenses/apache-2.0') return 'apache';
      if (id === '/licenses/mit') return 'mit';
      if (id === '/licenses/ubuntu-font-1.0') return 'ubuntu';
      if (id === '/licenses/cc0-1.0') return 'cc0';
    }
    return null;
  } catch {
    return null;
  }
}

export function licenseKind(license: string | null, licenseUrl: string | null): LicenseKind {
  const description = bounded(license) ?? '';
  const url = bounded(licenseUrl) ?? '';
  if (!description.trim() && !url.trim()) return 'none';
  const apacheVersion = description.match(
    /apache licen[sc]e(?:,?\s+(?:version|v))?[\s-]+(\d+\.\d+)\b/i,
  )?.[1];
  const oflVersion = description.match(
    /(?:open font licen[sc]e|\bOFL)(?:,?\s+(?:version|v))?[\s-]+(\d+\.\d+)\b/i,
  )?.[1];
  if ((apacheVersion && apacheVersion !== '2.0') || (oflVersion && oflVersion !== '1.1'))
    return 'unknown';
  const textKinds = KIND_PATTERNS.filter(([, pattern]) => pattern.test(description));
  if (textKinds.length > 1) return 'unknown';
  const textKind = textKinds[0]?.[0];
  const urlKind = urlLicenseKind(url);
  if (textKind && urlKind && textKind !== urlKind) return 'unknown';
  return textKind ?? urlKind ?? 'unknown';
}

const RESERVED = /reserved font names?/gi;
const NEGATED = /\b(?:no|not|without)\s+$/i;
const DEFINITION = /^["“”']?\s*(?:refers|means|is|are)\b/i;
const QUOTED = /"([^"]{1,80})"|“([^”]{1,80})”|'([^']{1,80})'|‘([^’]{1,80})’/g;

export function reservedFontNames(texts: readonly (string | null)[]): {
  present: boolean;
  names: string[];
} {
  const names = new Set<string>();
  let present = false;
  for (const raw of texts) {
    const text = bounded(raw);
    if (!text) continue;
    for (const match of text.matchAll(RESERVED)) {
      const start = match.index;
      const end = start + match[0].length;
      if (NEGATED.test(text.slice(Math.max(0, start - 12), start))) continue;
      if (DEFINITION.test(text.slice(end, end + 24))) continue;
      present = true;
      const sentence = text.slice(end, end + 160).split(/[;\n]|\.(?=\s|$)/)[0] ?? '';
      for (const quoted of sentence.matchAll(QUOTED)) {
        const name = (quoted[1] ?? quoted[2] ?? quoted[3] ?? quoted[4])?.trim();
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
  const copyright = bounded(input.copyright);
  const trademark = bounded(input.trademark);
  const licenseDescription = bounded(input.license);
  const licenseUrl = bounded(input.licenseUrl);
  const kind = licenseKind(licenseDescription, licenseUrl);
  const embedding = embeddingLevel(input.fsType);
  const noSubsetting = input.fsType !== null && (input.fsType & NO_SUBSETTING) !== 0;
  const bitmapOnly = input.fsType !== null && (input.fsType & BITMAP_ONLY) !== 0;
  const reserved = reservedFontNames([copyright, licenseDescription, trademark]);
  const conversionBlockReason =
    embedding === 'restricted' ? 'restricted' : bitmapOnly ? 'bitmap-only' : null;
  const subsettingBlockReason = conversionBlockReason ?? (noSubsetting ? 'no-subsetting' : null);
  const conversionBlocked = conversionBlockReason !== null;
  const subsettingBlocked = subsettingBlockReason !== null;
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
    conversionBlockReason,
    subsettingBlockReason,
    renameRequired,
    licenseFile:
      kind === 'unknown' || kind === 'none'
        ? null
        : { copyright, licenseText: LICENSE_TEXTS[kind], licenseDescription, licenseUrl },
    notices,
  };
}
