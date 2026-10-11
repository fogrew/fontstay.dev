function stripTags(text: string): string {
  let result = text;
  let previous: string;
  do {
    previous = result;
    result = result.replace(/<[^<>]*>/g, '');
  } while (result !== previous);
  return result.replace(/[<>]/g, '');
}

const decode = (text: string) =>
  stripTags(text)
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();

export function parseChromeosFontPackages(ebuild: string): Set<string> {
  return new Set([...ebuild.matchAll(/media-fonts\/([a-z0-9-]+)/g)].map((match) => match[1] ?? ''));
}

export interface WindowsFamilies {
  preinstalled: Set<string>;
  onDemand: Set<string>;
}

const FOD_HEADING = 'id="fonts-included-in-feature-on-demand-fod-packages"';

export function parseWindowsFontList(html: string): WindowsFamilies {
  const result: WindowsFamilies = { preinstalled: new Set(), onDemand: new Set() };
  const split = html.indexOf(FOD_HEADING);
  if (split < 0) throw new Error('Windows font list: Feature On Demand heading not found');
  for (const [text, target] of [
    [html.slice(0, split), result.preinstalled],
    [html.slice(split), result.onDemand],
  ] as const) {
    for (const row of text.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
      const first = /<td[^>]*>([\s\S]*?)<\/td>/.exec(row[1] ?? '');
      const name = first ? decode(first[1] ?? '') : '';
      if (name) target.add(name);
    }
  }
  return result;
}

export type AppleKind = 'system' | 'downloadable' | 'document';

export interface AppleFace {
  name: string;
  platforms: Record<string, AppleKind>;
}

const APPLE_KINDS: Record<string, AppleKind> = {
  'system font': 'system',
  downloadable: 'downloadable',
  'document support': 'document',
};

const APPLE_PLATFORM = /<span class="hidden">([^<]*?) (iOS|macOS|tvOS|watchOS|visionOS)<\/span>/g;

export function parseAppleSystemFonts(html: string): AppleFace[] {
  const faces: AppleFace[] = [];
  for (const item of html.split('<li class="font-item">').slice(1)) {
    const name = /filter-font-name">([^<]*)/.exec(item)?.[1];
    if (!name) continue;
    const platforms: Record<string, AppleKind> = {};
    for (const match of item.matchAll(APPLE_PLATFORM)) {
      const kind = APPLE_KINDS[match[1] ?? ''];
      if (kind && match[2]) platforms[match[2]] = kind;
    }
    faces.push({ name: decode(name).replace(/:\d+(\.\d+)?$/, ''), platforms });
  }
  return faces;
}

const STYLE_WORDS = new Set([
  'regular',
  'bold',
  'italic',
  'oblique',
  'light',
  'medium',
  'semibold',
  'demibold',
  'thin',
  'ultralight',
  'extralight',
  'extrabold',
  'roman',
  'book',
  'plain',
]);

export function appleStatus(
  faces: readonly AppleFace[],
  family: string,
  platform: string,
): 'preinstalled' | 'on-demand' | null {
  const wanted = family.toLowerCase();
  let status: 'preinstalled' | 'on-demand' | null = null;
  for (const face of faces) {
    const kind = face.platforms[platform];
    if (kind !== 'system' && kind !== 'downloadable') continue;
    const name = face.name.toLowerCase();
    const matches =
      name === wanted ||
      (name.startsWith(`${wanted} `) &&
        name
          .slice(wanted.length + 1)
          .split(/\s+/)
          .every((word) => STYLE_WORDS.has(word)));
    if (!matches) continue;
    if (kind === 'system') return 'preinstalled';
    status = 'on-demand';
  }
  return status;
}

export function parseOsFontListCsv(csv: string): Set<string> {
  const families = new Set<string>();
  for (const line of csv.split(/\r?\n/).slice(1)) {
    const quoted = /^"((?:[^"]|"")*)"/.exec(line);
    const family = (quoted ? (quoted[1] ?? '').replace(/""/g, '"') : line.split(',', 1)[0])?.trim();
    if (family) families.add(family);
  }
  return families;
}

export function parseAndroidFontFiles(xml: string): Set<string> {
  const files = new Set<string>();
  for (const match of xml.matchAll(/<font\b[^>]*>\s*([^<\s][^<]*?)\s*(?:<\/font>|<axis)/g)) {
    files.add((match[1] ?? '').trim());
  }
  return files;
}

export function parseUbuntuManifest(manifest: string): Set<string> {
  const packages = new Set<string>();
  for (const line of manifest.split(/\r?\n/)) {
    const name = line.split(/\s+/, 1)[0];
    if (name) packages.add(name);
  }
  return packages;
}
