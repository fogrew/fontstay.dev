import {
  analyzeLicense,
  licenseKind as detectedLicenseKind,
  type LICENSE_TEXTS,
} from '@/modules/font-license';
import { selfHostFontFaces } from './self-host';
import { createZip, type ZipEntry, ZipError } from './zip';

export interface SelfHostArchiveFont {
  family: string;
  fileName: string;
  weight: number;
  style: 'normal' | 'italic';
  bytes: Uint8Array;
  copyright: string | null;
  trademark?: string | null;
  license: string | null;
  licenseUrl: string | null;
  fsType?: number | null;
}

type LicenseKind = keyof typeof LICENSE_TEXTS;

export function licenseKind(license: string | null, url: string | null): LicenseKind | null {
  const kind = detectedLicenseKind(license, url);
  return kind === 'unknown' || kind === 'none' ? null : kind;
}

const slugOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '') || 'font';

const encoder = new TextEncoder();
const clean = (value: string) =>
  [...value]
    .map((char) => {
      const code = char.charCodeAt(0);
      return (code < 32 && code !== 10 && code !== 9) || code === 127 ? ' ' : char;
    })
    .join('')
    .trim();

export function licenseFile(family: string, fonts: readonly SelfHostArchiveFont[]): string {
  const copyrights = [...new Set(fonts.map((font) => clean(font.copyright ?? '')).filter(Boolean))];
  const license = fonts.map((font) => clean(font.license ?? '')).find(Boolean) ?? '';
  const url = fonts.map((font) => clean(font.licenseUrl ?? '')).find(Boolean) ?? '';
  const info = analyzeLicense({
    copyright: copyrights.join('\n') || null,
    trademark: fonts.map((font) => font.trademark ?? null).find(Boolean) ?? null,
    license: license || null,
    licenseUrl: url || null,
    fsType: fonts.find((font) => font.fsType !== undefined)?.fsType ?? null,
  });
  return [
    family,
    ...(copyrights.length > 0 ? ['', ...copyrights] : []),
    ...(license ? ['', license] : []),
    ...(url ? ['', url] : []),
    '',
    info.hasReservedFontName && info.kind === 'ofl'
      ? `Reserved Font Name: ${info.reservedFontNames.join(', ') || 'see the font metadata'}. Rename modified versions before publishing.`
      : '',
    info.licenseFile
      ? info.licenseFile.licenseText
      : 'The license of this font is not recognised. Check the license terms of the font before you publish it.',
    '',
  ].join('\n');
}

export function buildSelfHostArchive(
  fonts: readonly SelfHostArchiveFont[],
  css?: string,
  exportFile?: { fileName: string; text: string },
): Uint8Array {
  const entries: ZipEntry[] = [];
  const files = new Map<string, SelfHostArchiveFont>();
  for (const font of fonts) {
    const previous = files.get(font.fileName);
    if (
      previous &&
      (previous.bytes.length !== font.bytes.length ||
        previous.bytes.some((byte, index) => byte !== font.bytes[index]) ||
        previous.license !== font.license ||
        previous.licenseUrl !== font.licenseUrl ||
        previous.copyright !== font.copyright ||
        previous.trademark !== font.trademark ||
        previous.fsType !== font.fsType)
    )
      throw new ZipError('duplicate');
    if (!previous) entries.push({ name: `fonts/${font.fileName}`, data: font.bytes });
    files.set(font.fileName, font);
  }
  const used = new Set<string>();
  for (const font of files.values()) {
    const base = slugOf(font.fileName).slice(0, 180);
    let slug = base;
    for (let count = 2; used.has(slug); count++) slug = `${base}-${count}`;
    used.add(slug);
    entries.push({
      name: `licenses/${slug}.txt`,
      data: encoder.encode(licenseFile(font.family, [font])),
    });
  }
  entries.push({
    name: 'fonts.css',
    data: encoder.encode(`${css ?? selfHostFontFaces(fonts)}\n`),
  });
  if (exportFile && exportFile.fileName !== 'fonts.css')
    entries.push({ name: exportFile.fileName, data: encoder.encode(exportFile.text) });
  entries.push({
    name: 'README.txt',
    data: encoder.encode(
      [
        'Self-hosted fonts',
        '',
        'Upload the files from fonts/ to /fonts/ on your site, keep the license files from licenses/ next to them,',
        'and use fonts.css for the generated font and fallback rules.',
        '',
      ].join('\n'),
    ),
  });
  return createZip(entries);
}
