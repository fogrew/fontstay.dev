import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, expect, it } from 'vitest';
import { buildCli } from './build.mjs';

const scratch = mkdtempSync(join(fileURLToPath(new URL('../../', import.meta.url)), '.cli-test-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const fixture = (path: string) =>
  fileURLToPath(new URL(`../../tests/fixtures/${path}`, import.meta.url));

it('bundles a CLI that prints the CSS of the web app without a DOM', async () => {
  const out = await buildCli(join(scratch, 'dist'));
  const bin = join(out, 'bin.js');
  const css = execFileSync(
    process.execPath,
    [bin, 'fit', fixture('fonts/SourceSansPro-Regular.woff2'), '-a', 'defaults'],
    { encoding: 'utf8' },
  );
  expect(css).toBe(readFileSync(fixture('parity/source-sans-pro.defaults.expected'), 'utf8'));
  const bundle = readFileSync(join(out, 'index.js'), 'utf8');
  expect(bundle).not.toMatch(/\b(?:document|window)\./);
}, 60_000);
