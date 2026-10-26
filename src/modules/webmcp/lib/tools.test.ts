import { describe, expect, it, vi } from 'vitest';
import { findModelContext, registerWebMcp } from './register';
import { buildTools } from './tools';
import type { ToolHost, WebMcpTool } from './types';

function host(overrides: Partial<ToolHost> = {}): ToolHost {
  return {
    listFonts: () => [
      {
        id: 1,
        fileName: 'Inter.woff2',
        family: 'Inter',
        weight: 400,
        italic: false,
        variable: false,
        kind: 'sans-serif',
        scripts: ['latin'],
        glyphs: 300,
        selected: true,
      },
    ],
    selectFont: (id) => id === 1,
    analyzeFont: (id) => (id === 1 ? { glyphs: 300 } : undefined),
    getAudience: () => ({
      query: 'defaults',
      browserCount: 1,
      browsers: [{ entry: 'chrome 120', usage: 12.5 }],
      shares: { windows: 60 },
    }),
    setAudience: () => ({ ok: true, message: 'applied' }),
    suggest: () => [],
    setFallbacks: () => ({ ok: true, message: 'set' }),
    setKind: (id, kind) => id === 1 && kind === 'serif',
    getCss: () => 'css',
    getExport: (format) => (format === 'css' ? 'exported' : undefined),
    exportFormats: () => ['css'],
    getShift: () => undefined,
    ...overrides,
  };
}

const run = async (tools: WebMcpTool[], name: string, input: Record<string, unknown> = {}) => {
  const tool = tools.find((item) => item.name === name);
  if (!tool) throw new Error(`no tool ${name}`);
  return (await tool.execute(input)).content[0]?.text ?? '';
};

describe('tools', () => {
  const tools = buildTools(() => host());

  it('describes every tool with a valid schema and a unique name', () => {
    const names = tools.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    for (const tool of tools) {
      expect(tool.name).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.inputSchema.type).toBe('object');
      for (const key of tool.inputSchema.required ?? []) {
        expect(tool.inputSchema.properties[key]).toBeDefined();
      }
    }
  });

  it('answers from the host and rejects bad input without throwing', async () => {
    expect(JSON.parse(await run(tools, 'list-fonts'))[0].family).toBe('Inter');
    expect(JSON.parse(await run(tools, 'get-audience')).browsers[0].entry).toBe('chrome 120');
    expect(await run(tools, 'select-font', { id: 1 })).toBe('Selected.');
    expect(await run(tools, 'select-font', { id: 'x' })).toContain('no font');
    expect(await run(tools, 'analyze-font', { id: 9 })).toContain('no font');
    expect(await run(tools, 'set-audience', { query: '   ' })).toContain('empty');
    expect(await run(tools, 'set-audience', { query: 'defaults' })).toBe('applied');
    expect(await run(tools, 'set-font-kind', { fontId: 1, kind: 'serif' })).toContain('changed');
    expect(await run(tools, 'set-font-kind', { fontId: 1, kind: 'fantasy' })).toContain('Unknown');
    expect(await run(tools, 'get-export', { format: 'css' })).toBe('exported');
    expect(await run(tools, 'get-export', { format: 'nope' })).toContain('Use one of: css');
    expect(await run(tools, 'get-layout-shift')).toContain('not ready');
  });

  it('splits and bounds the fallback list and the query', async () => {
    const setFallbacks = vi.fn(() => ({ ok: true, message: 'set' }));
    const setAudience = vi.fn((_query: string) => ({ ok: true, message: 'applied' }));
    const bounded = buildTools(() => host({ setFallbacks, setAudience }));
    await run(bounded, 'set-fallbacks', {
      fontId: 1,
      system: 'windows',
      fonts: ' arial , ,segoe-ui,a,b,c,d,e,f,g ',
    });
    expect(setFallbacks).toHaveBeenCalledWith({
      fontId: 1,
      system: 'windows',
      fonts: ['arial', 'segoe-ui', 'a', 'b', 'c', 'd', 'e', 'f'],
    });
    await run(bounded, 'set-audience', { query: 'x'.repeat(2500) });
    expect(setAudience.mock.calls[0]?.[0]).toHaveLength(2000);
  });

  it('treats inherited property names as unknown topics', async () => {
    for (const topic of ['__proto__', 'constructor', 'toString']) {
      expect(await run(tools, 'explain-setting', { topic })).toContain('Topics:');
    }
  });

  it('explains known topics and lists the topics for unknown ones', async () => {
    expect(await run(tools, 'explain-setting', { topic: 'Size-Adjust' })).toContain(
      'average width',
    );
    expect(await run(tools, 'explain-setting', { topic: 'nope' })).toContain('Topics:');
  });
});

describe('registration', () => {
  it('does nothing without the browser API', () => {
    expect(
      registerWebMcp(
        buildTools(() => host()),
        { document: {}, navigator: {} },
      ),
    ).toBeUndefined();
  });

  it('registers every tool on document.modelContext and unregisters through the signal', () => {
    const registered: { name: string; signal?: AbortSignal }[] = [];
    const modelContext = {
      registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => {
        registered.push({
          name: tool.name,
          ...(options?.signal ? { signal: options.signal } : {}),
        });
      },
    };
    const stop = registerWebMcp(
      buildTools(() => host()),
      { document: { modelContext } },
    );
    expect(registered).toHaveLength(buildTools(() => host()).length);
    expect(registered[0]?.signal?.aborted).toBe(false);
    stop?.();
    expect(registered[0]?.signal?.aborted).toBe(true);
  });

  it('also finds navigator.modelContext and survives a throwing registry', () => {
    const modelContext = {
      registerTool: () => {
        throw new Error('nope');
      },
    };
    expect(findModelContext({ navigator: { modelContext } })).toBe(modelContext);
    expect(() =>
      registerWebMcp(
        buildTools(() => host()),
        { navigator: { modelContext } },
      ),
    ).not.toThrow();
  });
});
