import { readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const budget = JSON.parse(readFileSync(new URL('./perf-budget.json', import.meta.url), 'utf8'));

const STATIC_IMPORT = /(?:^|[;{}),\s])(?:import|export)\s*(?:[^'"()]*?from\s*)?["'](\.[^"']+)["']/g;

function staticImports(source) {
  return [...source.matchAll(STATIC_IMPORT)].map((match) => match[1]);
}

function closure(entry) {
  const seen = new Map();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    const bytes = readFileSync(`${root}${file}`);
    seen.set(file, gzipSync(bytes).length);
    for (const spec of staticImports(bytes.toString('utf8'))) {
      queue.push(posix.join(posix.dirname(file), spec));
    }
  }
  return seen;
}

let failed = false;
for (const [page, limitKb] of Object.entries(budget.initialJsGzipKb)) {
  const html = readFileSync(`${root}${page}/index.html`, 'utf8');
  const entries = new Set();
  for (const match of html.matchAll(/(?:component-url|renderer-url)="(\/[^"]+)"/g)) {
    entries.add(match[1].slice(1));
  }
  for (const match of html.matchAll(/<script[^>]+src="(\/_astro\/[^"]+)"/g)) {
    entries.add(match[1].slice(1));
  }
  const files = new Map();
  for (const entry of entries) {
    for (const [file, size] of closure(entry)) files.set(file, size);
  }
  const total = [...files.values()].reduce((sum, size) => sum + size, 0) / 1024;
  const status = total <= limitKb ? 'ok' : 'OVER';
  console.log(
    `${status} ${page}: ${total.toFixed(1)} kB gzip of initial JS (budget ${limitKb} kB, ${files.size} files)`,
  );
  if (total > limitKb) failed = true;
}
if (failed) {
  console.error('Initial JavaScript budget exceeded. See docs/performance.md.');
  process.exit(1);
}
