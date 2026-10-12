import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, platform, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createViteServer } from 'vitest/node';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = join(root, 'src/modules/os-fonts/data/metrics.json');
const variantsOutput = join(root, 'src/modules/os-fonts/data/variants.json');
const cache = join(tmpdir(), 'fontstay-os-fonts-cache');
mkdirSync(cache, { recursive: true });

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
  optimizeDeps: { noDiscovery: true },
});

try {
  const { parseFontBuffer } = await server.ssrLoadModule('/src/modules/font-metrics/lib/parse.ts');
  const { METRICS_SOURCES, SCRIPT_RANGES } = await server.ssrLoadModule(
    '/scripts/os-fonts/metrics-sources.ts',
  );
  const { readTarGz, readZip } = await server.ssrLoadModule('/scripts/os-fonts/archive.ts');
  const { collectionMember, isCollection } = await server.ssrLoadModule(
    '/scripts/os-fonts/sfnt.ts',
  );
  const { VARIANT_SOURCES, STYLE_IDS } = await server.ssrLoadModule(
    '/scripts/os-fonts/variant-sources.ts',
  );

  const existing = existsSync(output) ? JSON.parse(readFileSync(output, 'utf8')) : { fonts: [] };
  const existingVariants = existsSync(variantsOutput)
    ? JSON.parse(readFileSync(variantsOutput, 'utf8')).variants
    : {};
  const byId = new Map(
    existing.fonts.map((font) => [font.id, { ...font, variants: existingVariants[font.id] ?? {} }]),
  );

  const findLocal = (names) => {
    for (const dir of fontDirs) {
      if (!existsSync(dir)) continue;
      const entries = new Map(readdirSync(dir).map((name) => [name.toLowerCase(), name]));
      for (const wanted of names) {
        const found = entries.get(wanted.toLowerCase());
        if (found) return { bytes: readFileSync(join(dir, found)), file: found };
      }
    }
    return null;
  };

  const download = async (spec) => {
    const key = createHash('sha256').update(spec.url).digest('hex');
    const cached = join(cache, key);
    let raw;
    if (existsSync(cached)) raw = readFileSync(cached);
    else {
      const response = await fetch(spec.url, { headers: { 'user-agent': 'fontstay-metrics/1.0' } });
      if (!response.ok) throw new Error(`${spec.url}: HTTP ${response.status}`);
      raw = Buffer.from(await response.arrayBuffer());
      writeFileSync(cached, raw);
    }
    if (spec.base64) raw = Buffer.from(raw.toString('latin1'), 'base64');
    if (!spec.member)
      return { bytes: raw, file: decodeURIComponent(spec.url.split('/').pop().split('?')[0]) };
    const archive = spec.url.endsWith('.zip') ? readZip(raw) : readTarGz(raw);
    const member = archive.get(spec.member);
    if (!member) throw new Error(`${spec.url}: missing ${spec.member}`);
    return { bytes: member, file: spec.member };
  };

  const runs = (codePoints) => {
    const result = [];
    for (const cp of codePoints) {
      const last = result.length - 2;
      if (last >= 0 && result[last] + result[last + 1] === cp) result[last + 1] += 1;
      else result.push(cp, 1);
    }
    return result;
  };

  const measure = (found, source, variation, localNamesOverride) => {
    const bytes = isCollection(found.bytes) ? collectionMember(found.bytes, 0) : found.bytes;
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const font = parseFontBuffer(buffer, variation ? { variation } : {});
    const wanted = [];
    const advances = [];
    const covered = new Map();
    for (const [index, cp] of font.codePoints.entries()) covered.set(cp, font.advances[index]);
    for (const [from, to] of SCRIPT_RANGES) {
      for (let cp = from; cp <= to; cp++) {
        const advance = covered.get(cp);
        if (advance !== undefined) {
          wanted.push(cp);
          advances.push(variation ? Math.round(advance * 100) / 100 : advance);
        }
      }
    }
    const localNames = localNamesOverride ?? [
      ...new Set([font.names.fullName, font.names.postscript].filter((name) => Boolean(name))),
    ];
    return {
      count: wanted.length,
      isVariable: font.isVariable,
      entry: {
        source: { ...source, sha256: createHash('sha256').update(bytes).digest('hex') },
        localNames,
        unitsPerEm: font.unitsPerEm,
        hhea: font.hhea,
        typo: font.typo,
        win: font.win,
        codePoints: runs(wanted),
        advances,
      },
    };
  };

  for (const spec of METRICS_SOURCES) {
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
      console.log(
        `skipped ${spec.id}: font file not found${byId.has(spec.id) ? ' (kept previous entry)' : ''}`,
      );
      continue;
    }
    const base = measure(found, source, undefined, undefined);
    const variants = {};
    for (const style of STYLE_IDS) {
      const variant = VARIANT_SOURCES[spec.id]?.[style];
      if (!variant) continue;
      let variantFound = variant.files?.length ? findLocal(variant.files) : null;
      let variantSource = variantFound ? { kind: 'local', file: variantFound.file } : null;
      if (!variantFound && variant.download) {
        variantFound = await download(variant.download);
        variantSource = {
          kind: 'download',
          file: variantFound.file,
          url: variant.download.url,
          license: variant.download.license,
        };
      }
      if (!variantFound || !variantSource) {
        console.log(`skipped ${spec.id} ${style}: font file not found`);
        continue;
      }
      const measured = measure(variantFound, variantSource, variant.variation, variant.localNames);
      variants[style] = measured.entry;
    }
    const previous = byId.get(spec.id)?.variants ?? {};
    byId.set(spec.id, {
      id: spec.id,
      family: spec.family,
      ...base.entry,
      isVariable: base.isVariable,
      variants: { ...previous, ...variants },
    });
    console.log(
      `${spec.id}: ${base.count} code points, variants: ${Object.keys(variants).join(', ') || 'none'}`,
    );
  }

  const fonts = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  const variantMap = {};
  const baseFonts = fonts.map(({ variants, ...rest }) => {
    if (variants && Object.keys(variants).length > 0) variantMap[rest.id] = variants;
    return rest;
  });
  writeFileSync(output, `${JSON.stringify({ schema: 1, fonts: baseFonts })}\n`);
  writeFileSync(variantsOutput, `${JSON.stringify({ schema: 1, variants: variantMap })}\n`);
  console.log(`${fonts.length} fonts written`);
} finally {
  await server.close();
}
