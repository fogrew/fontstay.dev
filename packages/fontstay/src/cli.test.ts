import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { run } from './cli';

const font = (name: string) =>
  new URL(`../../../tests/fixtures/fonts/${name}`, import.meta.url).pathname.replace(
    /^\/([A-Za-z]:)/,
    '$1',
  );
const expected = (name: string) =>
  readFileSync(new URL(`../../../tests/fixtures/parity/${name}`, import.meta.url), 'utf8');

async function cli(...args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await run(args, {
    stdout: (text) => out.push(text),
    stderr: (text) => err.push(text),
  });
  return { code, stdout: out.join(''), stderr: err.join('') };
}

const scratch = mkdtempSync(join(tmpdir(), 'fontstay-cli-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe('fontstay fit', () => {
  it('prints the CSS of the web app for the same font and audience', async () => {
    const result = await cli('fit', font('SourceSansPro-Regular.woff2'), '--audience', 'defaults');
    expect(result.code).toBe(0);
    expect(result.stdout).toBe(expected('source-sans-pro.defaults.expected'));
    expect(result.stderr).toBe('');
  });

  it('restricts the systems and writes to a file', async () => {
    const out = join(scratch, 'fallbacks.css');
    const result = await cli(
      'fit',
      font('FiraSans-Regular.ttf'),
      '-a',
      'defaults',
      '-s',
      'windows,macos',
      '-o',
      out,
    );
    expect(result.code).toBe(0);
    expect(result.stdout).toBe('');
    expect(readFileSync(out, 'utf8')).toBe(expected('fira-sans.windows-macos.expected'));
  });

  it('exports other formats and a JSON report', async () => {
    const tailwind = await cli(
      'fit',
      font('FiraSans-Regular.ttf'),
      '-s',
      'windows',
      '-f',
      'tailwind',
    );
    expect(tailwind.stdout).toContain('@import "tailwindcss";');
    const json = await cli('fit', font('FiraSans-Regular.ttf'), '-s', 'windows', '--json');
    const report = JSON.parse(json.stdout);
    expect(report.file.fileName).toBe('fallback-fonts.css');
    expect(report.fonts[0].picks[0].system).toBe('windows');
    expect(report.css).toBeUndefined();
  });

  it('shows help and the version', async () => {
    expect((await cli('--help')).stdout).toContain('Usage: fontstay fit');
    expect((await cli('--version')).stdout).toMatch(/^\d+\.\d+\.\d+/);
  });

  it.each([
    [['fit'], 'Give at least one font file'],
    [['build', 'a.woff2'], 'Unknown command'],
    [['fit', 'a.woff2', '--format', 'scss'], 'Invalid --format'],
    [['fit', 'a.woff2', '--systems', 'windows,beos'], 'Invalid --systems entry'],
    [['fit', 'a.woff2', '--nope'], 'Unknown option'],
  ])('rejects bad usage %j with exit code 2', async (args, message) => {
    const result = await cli(...args);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain(message);
  });

  it('reports unreadable and invalid files with exit code 1', async () => {
    const missing = await cli('fit', join(scratch, 'missing.woff2'));
    expect(missing).toMatchObject({ code: 1 });
    expect(missing.stderr).toContain('ENOENT');
    const invalid = await cli('fit', join(import.meta.dirname, 'cli.ts'));
    expect(invalid.code).toBe(1);
    expect(invalid.stderr).toContain('could not be read');
  });

  it('rejects a file over the size limit and a directory without reading them', async () => {
    const big = join(scratch, 'big.woff2');
    writeFileSync(big, Buffer.alloc(10 * 1024 * 1024 + 1));
    const tooLarge = await cli('fit', big);
    expect(tooLarge.code).toBe(1);
    expect(tooLarge.stderr).toContain('too-large');
    expect((await cli('fit', scratch)).code).toBe(1);
  });

  it('reports an invalid audience with exit code 1', async () => {
    const result = await cli('fit', font('FiraSans-Regular.ttf'), '-a', 'not a query');
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Invalid audience "not a query"');
  });
});

describe('fontstay audit', () => {
  const file = join(scratch, 'faces.css');
  writeFileSync(
    file,
    '@font-face{font-family:A;src:url(a.woff2);unicode-range:U+20-2F,U+3A-40}@font-face{font-family:A;src:url(b.woff2);unicode-range:U+30-39,U+41-7E}',
  );

  it('prints a warning per issue and exits with 0', async () => {
    const result = await cli('audit', file);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('warning: faces.css: A 400 normal: basic Latin (U+20-7E)');
  });

  it('prints a JSON report', async () => {
    const result = await cli('audit', file, '--json');
    expect(JSON.parse(result.stdout)).toMatchObject([
      { file: 'faces.css', rules: 2, issues: [{ kind: 'latin-split', rules: [0, 1] }] },
    ]);
  });

  it('needs a file and reports an unreadable one', async () => {
    expect((await cli('audit')).code).toBe(2);
    expect((await cli('audit', join(scratch, 'missing.css'))).code).toBe(1);
  });
});
