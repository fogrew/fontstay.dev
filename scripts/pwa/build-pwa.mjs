import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../../dist/', import.meta.url));
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

const EXCLUDED = new Set(['sw.js', 'version.json', '_headers', '_redirects']);

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

const entries = walk(dist)
  .map((file) => relative(dist, file).split(sep).join('/'))
  .filter((path) => !EXCLUDED.has(path) && !path.endsWith('.map'))
  .sort();

const hash = createHash('sha256');
for (const path of entries) {
  hash.update(path);
  hash.update(readFileSync(join(dist, path)));
}
const build = hash.digest('hex').slice(0, 16);

const urls = entries.map((path) => {
  if (path === 'index.html') return '/';
  if (path.endsWith('/index.html')) return `/${path.slice(0, -'index.html'.length)}`;
  return `/${path}`;
});

const template = readFileSync(new URL('./sw.template.js', import.meta.url), 'utf8');
const worker = template
  .replace('__VERSION__', pkg.version)
  .replace('__BUILD__', build)
  .replace('__PRECACHE__', JSON.stringify(urls));
writeFileSync(join(dist, 'sw.js'), worker);
writeFileSync(join(dist, 'version.json'), `${JSON.stringify({ version: pkg.version, build })}\n`);
console.log(
  `service worker: ${urls.length} precached files, version ${pkg.version}, build ${build}`,
);
