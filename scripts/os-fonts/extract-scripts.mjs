import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { create } from 'fontkitten';
import { createViteServer } from 'vitest/node';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = join(root, 'src/modules/os-fonts/data/script-coverage.json');

const extraDirs = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const fontDirs = [
  ...extraDirs,
  ...(platform() === 'win32'
    ? [join(process.env.WINDIR ?? 'C:\\Windows', 'Fonts')]
    : platform() === 'darwin'
      ? [
          '/System/Library/Fonts',
          '/System/Library/Fonts/Supplemental',
          '/Library/Fonts',
          join(homedir(), 'Library/Fonts'),
        ]
      : ['/usr/share/fonts', '/usr/local/share/fonts', join(homedir(), '.fonts')]),
];

const server = await createViteServer({
  root,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false, watch: null },
  resolve: { tsconfigPaths: true },
  optimizeDeps: { noDiscovery: true },
});

try {
  const { SCRIPT_CORE_SPANS } = await server.ssrLoadModule(
    '/src/modules/generator/lib/script-stacks.ts',
  );
  const { SCRIPT_SOURCES } = await server.ssrLoadModule('/scripts/os-fonts/script-sources.ts');
  const { collectionMember, isCollection } = await server.ssrLoadModule(
    '/scripts/os-fonts/sfnt.ts',
  );

  let existing = [];
  try {
    existing = JSON.parse(readFileSync(output, 'utf8')).fonts;
  } catch {}
  const byId = new Map(existing.map((font) => [font.id, font]));

  const findLocal = (names) => {
    for (const dir of fontDirs) {
      let listing;
      try {
        listing = readdirSync(dir);
      } catch {
        continue;
      }
      const entries = new Map(listing.map((name) => [name.toLowerCase(), name]));
      for (const wanted of names) {
        const found = entries.get(wanted.toLowerCase());
        if (found) return { bytes: readFileSync(join(dir, found)), file: found };
      }
    }
    return null;
  };

  const download = async (spec) => {
    const response = await fetch(spec.url, { headers: { 'user-agent': 'fontstay-metrics/1.0' } });
    if (!response.ok) throw new Error(`${spec.url}: HTTP ${response.status}`);
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.length > 50 * 1024 * 1024) throw new Error(`${spec.url}: larger than 50 MB`);
    return { bytes: raw, file: decodeURIComponent(spec.url.split('/').pop().split('?')[0]) };
  };

  const letter = /\p{L}/u;
  const totals = {};
  for (const [script, spans] of Object.entries(SCRIPT_CORE_SPANS)) {
    totals[script] = 0;
    for (const [from, to] of spans) {
      for (let cp = from; cp <= to; cp++) {
        if (letter.test(String.fromCodePoint(cp))) totals[script]++;
      }
    }
  }

  let missing = 0;
  for (const spec of SCRIPT_SOURCES) {
    let found = spec.files.length > 0 ? findLocal(spec.files) : null;
    let source = found ? { kind: 'local', file: found.file } : null;
    if (!found && spec.download) {
      found = await download(spec.download);
      source = {
        kind: 'download',
        file: found.file,
        url: spec.download.url,
        license: spec.download.license,
      };
    }
    if (!found || !source) {
      if (!byId.has(spec.id)) missing++;
      console.log(
        `skipped ${spec.id}: font file not found${byId.has(spec.id) ? ' (kept previous entry)' : ''}`,
      );
      continue;
    }
    const bytes = isCollection(found.bytes) ? collectionMember(found.bytes, 0) : found.bytes;
    const covered = new Set(create(new Uint8Array(bytes)).characterSet);
    const scripts = {};
    for (const [script, spans] of Object.entries(SCRIPT_CORE_SPANS)) {
      let count = 0;
      for (const [from, to] of spans) {
        for (let cp = from; cp <= to; cp++) {
          if (covered.has(cp) && letter.test(String.fromCodePoint(cp))) count++;
        }
      }
      if (count > 0) scripts[script] = count;
    }
    byId.set(spec.id, {
      id: spec.id,
      family: spec.family,
      aliases: [...(spec.aliases ?? [])],
      source: { ...source, sha256: createHash('sha256').update(bytes).digest('hex') },
      scripts,
    });
    console.log(
      `${spec.id}: ${Object.entries(scripts)
        .map(([script, share]) => `${script} ${share}/${totals[script]}`)
        .join(', ')}`,
    );
  }

  if (missing > 0) process.exitCode = 1;
  const fonts = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(output, `${JSON.stringify({ schema: 1, totals, fonts })}\n`);
  console.log(`${fonts.length} fonts written`);
} finally {
  await server.close();
}
