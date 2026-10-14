import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type {
  Availability,
  OsFont,
  OsFontsDataset,
  OsId,
  Status,
} from '../../src/modules/os-fonts/lib/model.ts';
import {
  ANDROID_TAGS,
  APPLE_SOURCE,
  CHROMEOS_SOURCE,
  DEBIAN_MANIFESTS,
  FAMILIES,
  OS_FONT_LIST_MACOS,
  UBUNTU_MANIFESTS,
  WINDOWS_LISTS,
} from './families.ts';
import {
  appleStatus,
  parseAndroidFontFiles,
  parseAppleSystemFonts,
  parseChromeosFontPackages,
  parseOsFontListCsv,
  parseUbuntuManifest,
  parseWindowsFontList,
} from './sources.ts';

const out = fileURLToPath(
  new URL('../../src/modules/os-fonts/data/os-fonts.json', import.meta.url),
);

function expectAtLeast(what: string, count: number, minimum: number) {
  if (count < minimum) throw new Error(`${what}: expected at least ${minimum}, got ${count}`);
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { 'user-agent': 'fontstay-os-fonts-import/1.0' } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

interface Hit {
  os: OsId;
  version: string;
  status: Status;
  source: string;
}

const hits = new Map<string, Hit[]>();
const add = (id: string, hit: Hit) => hits.set(id, [...(hits.get(id) ?? []), hit]);

for (const [version, url] of WINDOWS_LISTS) {
  const lists = parseWindowsFontList(await fetchText(url));
  expectAtLeast(`Windows ${version} preinstalled families`, lists.preinstalled.size, 40);
  for (const spec of FAMILIES) {
    if (!spec.windows) continue;
    if (lists.preinstalled.has(spec.windows)) {
      add(spec.id, { os: 'windows', version, status: 'preinstalled', source: url });
    } else if (lists.onDemand.has(spec.windows)) {
      add(spec.id, { os: 'windows', version, status: 'on-demand', source: url });
    }
  }
}

const apple = parseAppleSystemFonts(await fetchText(APPLE_SOURCE));
expectAtLeast('Apple faces', apple.length, 1000);
for (const spec of FAMILIES) {
  if (!spec.apple) continue;
  for (const [platform, os] of [
    ['macOS', 'macos'],
    ['iOS', 'ios'],
  ] as const) {
    const status = appleStatus(apple, spec.apple, platform);
    if (status) add(spec.id, { os, version: 'current', status, source: APPLE_SOURCE });
  }
}

for (const [version, url] of OS_FONT_LIST_MACOS) {
  const families = new Set(
    [...parseOsFontListCsv(await fetchText(url))].map((family) => family.toLowerCase()),
  );
  for (const spec of FAMILIES) {
    if (spec.apple && families.has(spec.apple.toLowerCase())) {
      add(spec.id, { os: 'macos', version, status: 'preinstalled', source: url });
    }
  }
}

for (const [version, tag] of ANDROID_TAGS) {
  const url = `https://android.googlesource.com/platform/frameworks/base/+/refs/tags/${tag}/data/fonts/fonts.xml`;
  const encoded = await fetchText(`${url}?format=TEXT`);
  const files = [...parseAndroidFontFiles(Buffer.from(encoded, 'base64').toString('utf8'))];
  expectAtLeast(`Android ${version} font files`, files.length, 100);
  for (const spec of FAMILIES) {
    if (spec.androidFiles && files.some((file) => spec.androidFiles?.test(file))) {
      add(spec.id, { os: 'android', version, status: 'preinstalled', source: url });
    }
  }
}

for (const [version, url] of [...UBUNTU_MANIFESTS, ...DEBIAN_MANIFESTS]) {
  const packages = parseUbuntuManifest(await fetchText(url));
  expectAtLeast(`${version} packages`, packages.size, 500);
  for (const spec of FAMILIES) {
    if (spec.linuxPackages?.some((name) => packages.has(name))) {
      add(spec.id, { os: 'linux', version, status: 'preinstalled', source: url });
    }
  }
}

{
  const [version, url] = CHROMEOS_SOURCE;
  const encoded = await fetchText(`${url}?format=TEXT`);
  const packages = parseChromeosFontPackages(Buffer.from(encoded, 'base64').toString('utf8'));
  expectAtLeast('ChromeOS font packages', packages.size, 4);
  for (const spec of FAMILIES) {
    if (spec.chromeosPackages?.some((name) => packages.has(name))) {
      add(spec.id, { os: 'chromeos', version, status: 'preinstalled', source: url });
    }
  }
}

function merge(list: Hit[]): Availability[] {
  const groups = new Map<string, Availability>();
  for (const hit of list) {
    const key = `${hit.os}|${hit.status}|${hit.source}`;
    const group = groups.get(key);
    if (group) group.versions.push(hit.version);
    else
      groups.set(key, {
        os: hit.os,
        versions: [hit.version],
        status: hit.status,
        source: hit.source,
      });
  }
  return [...groups.values()];
}

const fonts: OsFont[] = FAMILIES.flatMap((spec) => {
  const list = hits.get(spec.id);
  return list
    ? [{ id: spec.id, family: spec.family, category: spec.category, availability: merge(list) }]
    : [];
});

const dataset: OsFontsDataset = {
  schema: 1,
  generated: new Date().toISOString().slice(0, 10),
  platforms: {
    windows: { versions: WINDOWS_LISTS.map(([version]) => version) },
    macos: {
      versions: [...OS_FONT_LIST_MACOS.map(([version]) => version), 'current'],
      note: 'Versions between 10.15 and the current release are not covered by a source.',
    },
    ios: { versions: ['current'] },
    android: {
      versions: ANDROID_TAGS.map(([version]) => version),
      note: 'AOSP fonts only; vendor builds add or replace fonts, and local() support depends on the browser.',
    },
    linux: {
      versions: [...UBUNTU_MANIFESTS, ...DEBIAN_MANIFESTS].map(([version]) => version),
    },
    chromeos: {
      versions: [CHROMEOS_SOURCE[0]],
      note: 'Chromium OS font packages; devices differ by board and Chrome OS version.',
    },
  },
  fonts,
};

const missing = FAMILIES.filter((spec) => !hits.has(spec.id));
if (missing.length > 0) {
  throw new Error(`No source evidence for: ${missing.map((spec) => spec.family).join(', ')}`);
}
writeFileSync(out, `${JSON.stringify(dataset, null, 2)}\n`);
console.log(`${fonts.length} of ${FAMILIES.length} families written`);
for (const spec of FAMILIES)
  if (!hits.has(spec.id)) console.log(`no source evidence: ${spec.family}`);
