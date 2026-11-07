import { LICENSE_TEXTS } from './license-texts';
import { selfHostFontFaces } from './self-host';
import { createZip, type ZipEntry } from './zip';

export interface SelfHostArchiveFont {
  family: string;
  fileName: string;
  weight: number;
  style: 'normal' | 'italic';
  bytes: Uint8Array;
  copyright: string | null;
  license: string | null;
  licenseUrl: string | null;
}

type LicenseKind = keyof typeof LICENSE_TEXTS;

const OFL = /open font licen[sc]e|scripts\.sil\.org\/ofl|openfontlicense\.org|\bOFL\b/i;
const APACHE = /apache licen[sc]e|apache\.org\/licenses/i;
const UBUNTU = /ubuntu font licen[sc]e|ubuntu\.com\/legal\/terms-and-policies\/font-licen/i;

export function licenseKind(license: string | null, url: string | null): LicenseKind | null {
  const text = `${license ?? ''}\n${url ?? ''}`;
  if (OFL.test(text)) return 'ofl';
  if (APACHE.test(text)) return 'apache';
  if (UBUNTU.test(text)) return 'ubuntu';
  return null;
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
  const kind = licenseKind(license, url);
  return [
    family,
    ...(copyrights.length > 0 ? ['', ...copyrights] : []),
    ...(license ? ['', license] : []),
    ...(url ? ['', url] : []),
    '',
    kind
      ? LICENSE_TEXTS[kind]
      : 'The license of this font is not recognised. Check the license terms of the font before you publish it.',
    '',
  ].join('\n');
}

export function buildSelfHostArchive(fonts: readonly SelfHostArchiveFont[]): Uint8Array {
  const entries: ZipEntry[] = [];
  const files = new Set<string>();
  const byFamily = new Map<string, SelfHostArchiveFont[]>();
  for (const font of fonts) {
    if (!files.has(font.fileName))
      entries.push({ name: `fonts/${font.fileName}`, data: font.bytes });
    files.add(font.fileName);
    byFamily.set(font.family, [...(byFamily.get(font.family) ?? []), font]);
  }
  const used = new Set<string>();
  for (const [family, items] of byFamily) {
    let slug = slugOf(family);
    for (let count = 2; used.has(slug); count++) slug = `${slugOf(family)}-${count}`;
    used.add(slug);
    entries.push({
      name: `licenses/${slug}.txt`,
      data: encoder.encode(licenseFile(family, items)),
    });
  }
  entries.push({
    name: 'fonts.css',
    data: encoder.encode(`${selfHostFontFaces(fonts)}\n`),
  });
  entries.push({
    name: 'README.txt',
    data: encoder.encode(
      [
        'Self-hosted fonts',
        '',
        'Upload the files from fonts/ to /fonts/ on your site, keep the license files from licenses/ next to them,',
        'and put the @font-face rules from fonts.css before your fallback rules.',
        '',
      ].join('\n'),
    ),
  });
  return createZip(entries);
}
