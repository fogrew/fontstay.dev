import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildCli } from '../../../scripts/cli/build.mjs';
import { handleMessage, serve } from './mcp';

const fixture = (name: string) =>
  fileURLToPath(new URL(`../../../tests/fixtures/fonts/${name}`, import.meta.url));
const expected = (name: string) =>
  new URL(`../../../tests/fixtures/parity/${name}`, import.meta.url);

const scratch = mkdtempSync(join(tmpdir(), 'fontstay-mcp-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

interface Result {
  protocolVersion?: string;
  capabilities?: unknown;
  serverInfo?: { name: string; version: string };
  tools?: { name: string; inputSchema: { type: string }; annotations: { readOnlyHint: boolean } }[];
  content?: { text: string }[];
  isError?: boolean;
}
type Reply = { id?: number | null; result: Result; error?: { code: number; message: string } };

async function exchange(lines: string[]): Promise<Reply[]> {
  const input = new PassThrough();
  const output = new PassThrough();
  const chunks: Buffer[] = [];
  output.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = serve(input, output);
  for (const line of lines) input.write(`${line}\n`);
  input.end();
  await done;
  return Buffer.concat(chunks)
    .toString('utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Reply);
}

const request = (id: number, method: string, params?: unknown) =>
  JSON.stringify({ jsonrpc: '2.0', id, method, params });

const call = async (name: string, args: unknown) => {
  const [reply] = await exchange([request(1, 'tools/call', { name, arguments: args })]);
  return reply as Reply;
};

describe('protocol', () => {
  it('negotiates the protocol version and advertises the tools capability', async () => {
    const [known, unknown] = await exchange([
      request(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {} }),
      request(2, 'initialize', { protocolVersion: '1999-01-01', capabilities: {} }),
    ]);
    expect(known?.result.protocolVersion).toBe('2025-06-18');
    expect(unknown?.result.protocolVersion).toBe('2025-11-25');
    expect(known?.result.capabilities).toEqual({ tools: { listChanged: false } });
    expect(known?.result.serverInfo?.name).toBe('fontstay');
    expect(known?.result.serverInfo?.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('answers ping, stays silent on notifications and lists the tools', async () => {
    const replies = await exchange([
      JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      request(1, 'ping'),
      request(2, 'tools/list'),
    ]);
    expect(replies.map((reply) => reply.id)).toEqual([1, 2]);
    const tools = replies[1]?.result.tools ?? [];
    const names = tools.map((tool) => tool.name);
    expect(names).toEqual([
      'analyze_font',
      'suggest_fallbacks',
      'audit_font_faces',
      'get_css',
      'get_export',
    ]);
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.annotations.readOnlyHint).toBe(true);
    }
  });

  it('reports malformed input as JSON-RPC errors', async () => {
    const replies = await exchange([
      '{not json',
      '[]',
      JSON.stringify({ jsonrpc: '1.0', id: 1, method: 'ping' }),
      JSON.stringify({ jsonrpc: '2.0', id: {}, method: 'ping' }),
      request(2, 'resources/list'),
      request(3, 'tools/call', { name: 'nope' }),
      request(4, 'tools/call', { arguments: {} }),
      request(5, 'tools/call', { name: 'get_css', arguments: 'x' }),
    ]);
    expect(replies.map((reply) => reply.error?.code)).toEqual([
      -32700, -32600, -32600, -32600, -32601, -32602, -32602, -32602,
    ]);
    expect(replies[2]?.id).toBe(1);
  });

  it('drops a message that grows past the line cap across chunks and keeps serving', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const chunks: Buffer[] = [];
    output.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = serve(input, output);
    for (let part = 0; part < 3; part++) input.write('x'.repeat(512 * 1024));
    input.write(`\n${request(1, 'ping')}\n`);
    input.end();
    await done;
    const replies = Buffer.concat(chunks)
      .toString('utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Reply);
    expect(replies.map((reply) => reply.error?.message ?? reply.result)).toEqual([
      'Message too large.',
      {},
    ]);
  });

  it('answers an invalid id with a null id', async () => {
    const [reply] = await exchange([JSON.stringify({ jsonrpc: '1.0', id: {}, method: 'ping' })]);
    expect(reply?.id).toBeNull();
  });

  it('rejects an oversized message and keeps serving', async () => {
    const replies = await exchange([
      `{"pad":"${'x'.repeat(2 * 1024 * 1024)}"}`,
      request(1, 'ping'),
    ]);
    expect(replies.map((reply) => reply.error?.message ?? reply.result)).toEqual([
      'Message too large.',
      {},
    ]);
  });

  it('does not answer notifications of unknown methods', async () => {
    expect(await handleMessage({ jsonrpc: '2.0', method: 'whatever' })).toBeUndefined();
  });
});

describe('tools', () => {
  const text = (reply: Reply, index = 0): string => reply.result.content?.[index]?.text ?? '';

  it('analyzes a font', async () => {
    const reply = await call('analyze_font', { path: fixture('SourceSansPro-Regular.woff2') });
    expect(reply.result.isError).toBeUndefined();
    const analysis = JSON.parse(text(reply));
    expect(analysis.names.family).toBe('Source Sans Pro');
    expect(analysis.scripts).toContain('latin');
    expect(analysis.verticalMetrics.hhea.ascent).toBeGreaterThan(0);
  });

  it('returns the CSS of the app for the same font and audience', async () => {
    const reply = await call('get_css', {
      paths: [fixture('SourceSansPro-Regular.woff2')],
      audience: 'defaults',
    });
    const { readFileSync } = await import('node:fs');
    expect(text(reply)).toBe(
      readFileSync(expected('source-sans-pro.defaults.expected'), 'utf8').trimEnd(),
    );
  });

  it('suggests fallbacks per system', async () => {
    const reply = await call('suggest_fallbacks', {
      paths: [fixture('FiraSans-Regular.ttf')],
      audience: 'defaults',
      systems: ['windows', 'macos'],
    });
    const suggestion = JSON.parse(text(reply));
    expect(suggestion.systems).toEqual(expect.arrayContaining(['windows', 'macos']));
    expect(suggestion.fonts[0].picks.map((pick: { system: string }) => pick.system).sort()).toEqual(
      ['macos', 'windows'],
    );
    expect(suggestion.fonts[0].coverage).toBeGreaterThan(0);
  });

  it('exports another format with a file name', async () => {
    const reply = await call('get_export', {
      paths: [fixture('FiraSans-Regular.ttf')],
      systems: ['windows'],
      format: 'tailwind',
    });
    expect(text(reply)).toContain('--font-sans');
    expect(text(reply, 1)).toMatch(/^Suggested file name: .+/);
  });

  it('names the unreadable font among several', async () => {
    const garbage = join(scratch, 'second.woff2');
    writeFileSync(garbage, 'not a font');
    const reply = await call('get_css', { paths: [fixture('FiraSans-Regular.ttf'), garbage] });
    expect(reply.result.isError).toBe(true);
    expect(text(reply)).toMatch(/second\.woff2.*could not be read/);
  });

  it('rejects audience queries that load packages from disk', async () => {
    for (const audience of [
      'extends browserslist-config-x',
      '> 1% in browserslist-config-x',
      'last 2 versions, > 1% in my-stats-pkg',
      '> 5% in ab stats',
      '> 5% in alt-eu stats',
      'cover 99% in ab stats',
      '> 1% in US-pkg',
      '> 1% IN pkg',
      '> 1% in	pkg',
      'EXTENDS browserslist-config-x',
    ]) {
      const reply = await call('get_css', { paths: [fixture('FiraSans-Regular.ttf')], audience });
      expect(reply.result.isError, audience).toBe(true);
      expect(text(reply), audience).toMatch(/"audience"/);
    }
    for (const audience of [
      'last 2 versions and > 1% in US',
      '> 1% in alt-eu',
      'last 2 versions',
    ]) {
      const ok = await call('get_css', {
        paths: [fixture('FiraSans-Regular.ttf')],
        audience,
        systems: ['windows'],
      });
      expect(ok.result.isError, audience).toBeUndefined();
    }
  });

  it.runIf(process.platform === 'win32')('does not open network paths', async () => {
    const reply = await call('analyze_font', { path: '//example.invalid/share/x.ttf' });
    expect(reply.result.isError).toBe(true);
    expect(text(reply)).toMatch(/network paths/);
  });

  it('reports failures as tool errors the agent can act on', async () => {
    const garbage = join(scratch, 'garbage.woff2');
    writeFileSync(garbage, 'not a font');
    const cases: [string, unknown, RegExp][] = [
      ['get_css', { paths: [join(scratch, 'missing.ttf')] }, /file not found/],
      ['get_css', { paths: [scratch] }, /not a regular file/],
      ['get_css', { paths: [garbage] }, /garbage\.woff2.*could not be read \(/],
      ['analyze_font', { path: garbage }, /could not be read \(/],
      ['get_css', { paths: [] }, /"paths"/],
      ['get_css', { paths: [fixture('FiraSans-Regular.ttf')], systems: ['plan9'] }, /"systems"/],
      [
        'get_css',
        { paths: [fixture('FiraSans-Regular.ttf')], audience: '???' },
        /Invalid audience/,
      ],
      ['get_export', { paths: [fixture('FiraSans-Regular.ttf')], format: 'docx' }, /"format"/],
      ['analyze_font', {}, /"path"/],
    ];
    for (const [name, args, pattern] of cases) {
      const reply = await call(name, args);
      expect(reply.error).toBeUndefined();
      expect(reply.result.isError, name).toBe(true);
      expect(text(reply), name).toMatch(pattern);
    }
  });
});

describe('stdio server', () => {
  let bin = '';
  beforeAll(async () => {
    bin = join(await buildCli(), 'bin.js');
  }, 60_000);

  it('talks to a client over a real process', async () => {
    const child = spawn(process.execPath, [bin, 'mcp'], { cwd: scratch, stdio: 'pipe' });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.stdin.write(
      `${request(1, 'initialize', { protocolVersion: '2025-11-25', capabilities: {} })}\n`,
    );
    child.stdin.write(
      `${request(2, 'tools/call', { name: 'get_css', arguments: { paths: [fixture('FiraSans-Regular.ttf')], systems: ['windows'] } })}\n`,
    );
    child.stdin.end();
    let stdout = '';
    for await (const chunk of child.stdout) stdout += chunk;
    const replies = stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Reply);
    expect(replies.map((reply) => reply.id)).toEqual([1, 2]);
    expect(replies[1]?.result.content?.[0]?.text).toContain('@font-face');
    expect(stderr).toBe('');
  }, 30_000);
});

describe('audit_font_faces', () => {
  const css =
    '@font-face{font-family:A;src:url(a.woff2);unicode-range:U+80-FF}@font-face{font-family:A;src:url(b.woff2);unicode-range:U+80-17F}';

  it('reports overlapping rules of a CSS file', async () => {
    const file = join(scratch, 'split.css');
    writeFileSync(file, css);
    const reply = await call('audit_font_faces', { paths: [file] });
    expect(reply.result.isError).toBeUndefined();
    expect(reply.result.content?.[0]?.text).toContain(
      'A 400 normal: rules 1, 2 overlap on 128 characters',
    );
  });

  it('says so when nothing is wrong and rejects missing files and bad input', async () => {
    const clean = join(scratch, 'clean.css');
    writeFileSync(clean, '@font-face{font-family:A;src:url(a.woff2)}');
    expect((await call('audit_font_faces', { paths: [clean] })).result.content?.[0]?.text).toBe(
      'No split-font problems found.',
    );
    const missing = await call('audit_font_faces', { paths: [join(scratch, 'none.css')] });
    expect(missing.result.isError).toBe(true);
    expect((await call('audit_font_faces', { paths: [] })).result.isError).toBe(true);
  });
});
