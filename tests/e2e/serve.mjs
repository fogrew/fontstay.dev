import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.env.DIST_DIR
  ? `${resolve(process.env.DIST_DIR)}${sep}`
  : fileURLToPath(new URL('../../dist/', import.meta.url));
const port = Number(process.argv[2] ?? 4321);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
};

function parseHeaders(source) {
  const rules = [];
  for (const line of source.split(/\r?\n/)) {
    if (line.trim() === '' || line.startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      const escaped = line.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&');
      rules.push({ pattern: new RegExp(`^${escaped.replaceAll('*', '.*')}$`), headers: [] });
    } else {
      const detach = line.trim().startsWith('!');
      const separator = line.indexOf(':');
      rules
        .at(-1)
        ?.headers.push(
          detach
            ? [line.trim().slice(1).trim(), null]
            : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()],
        );
    }
  }
  return rules;
}

const headerFile = join(root, '_headers');
const rules = existsSync(headerFile) ? parseHeaders(readFileSync(headerFile, 'utf8')) : [];

function headersFor(pathname) {
  const result = {};
  for (const rule of rules) {
    if (!rule.pattern.test(pathname)) continue;
    for (const [name, value] of rule.headers) {
      const key = name.toLowerCase();
      if (value === null) {
        delete result[key];
        continue;
      }
      result[key] = result[key] ? `${result[key]}, ${value}` : value;
    }
  }
  return result;
}

function resolveFile(pathname) {
  if (pathname === '/_headers') return null;
  const target = normalize(join(root, pathname));
  if (target !== root.slice(0, -1) && !target.startsWith(root)) return null;
  if (existsSync(target) && statSync(target).isFile()) return target;
  const index = join(target, 'index.html');
  return existsSync(index) ? index : null;
}

createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  } catch {
    response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Bad request');
    return;
  }
  const file = resolveFile(pathname);
  const isDirectory =
    file?.endsWith(`${sep}index.html`) &&
    !pathname.endsWith('/') &&
    !pathname.endsWith('index.html');
  if (file && isDirectory) {
    response.writeHead(308, { location: `${pathname}/` });
    response.end();
    return;
  }
  if (!file) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  response.writeHead(200, {
    'content-type': types[extname(file)] ?? 'application/octet-stream',
    'cache-control': 'public, max-age=0, must-revalidate',
    ...headersFor(pathname),
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(file)
    .on('error', () => response.destroy())
    .pipe(response);
}).listen({ port, host: '::', backlog: 1024 });
