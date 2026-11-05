import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, waitForGenerator } from './fixtures';

const fixture = (path: string) => fileURLToPath(new URL(`../fixtures/${path}`, import.meta.url));

const TOLERANCE_POINTS = 2;

function comparable(css: string) {
  const text = css.replace(/\n*\.fonts-loading \{[^}]*\}/, '').trim();
  const values = [...text.matchAll(/(-?\d+(?:\.\d+)?)%/g)].map((match) => Number(match[1]));
  return { skeleton: text.replace(/-?\d+(?:\.\d+)?%/g, '#'), values };
}

function difference(app: string, cli: string): string {
  const got = comparable(app);
  const want = comparable(cli);
  if (got.skeleton !== want.skeleton) return `structure differs:\n${app}\n---\n${cli}`;
  const far = got.values.findIndex(
    (value, index) => Math.abs(value - (want.values[index] ?? Number.NaN)) > TOLERANCE_POINTS,
  );
  return far < 0 ? 'match' : `value ${far}: app ${got.values[far]} vs CLI ${want.values[far]}`;
}

const CASES = [
  {
    name: 'Source Sans Pro for the defaults audience',
    font: 'fonts/SourceSansPro-Regular.woff2',
    query: 'defaults',
    expected: 'parity/source-sans-pro.defaults.expected',
  },
  {
    name: 'Fira Sans for Windows and macOS',
    font: 'fonts/FiraSans-Regular.ttf',
    query: 'defaults, os windows, os macos',
    expected: 'parity/fira-sans.windows-macos.expected',
  },
];

for (const { name, font, query, expected } of CASES) {
  test(`the web app generates the same CSS as the CLI: ${name}`, async ({ page }) => {
    await page.addInitScript(() => {
      const tools: Record<string, { execute: (input: object) => Promise<unknown> }> = {};
      (window as unknown as { __tools: typeof tools }).__tools = tools;
      (document as unknown as { modelContext: unknown }).modelContext = {
        registerTool: (tool: { name: string; execute: never }) => {
          tools[tool.name] = tool;
        },
      };
    });
    await page.goto('/en/');
    await waitForGenerator(page);
    await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(fixture(font));
    const call = (toolName: string, input: object = {}) =>
      page.evaluate(
        async ([tool, args]) => {
          const tools = (
            window as unknown as {
              __tools: Record<
                string,
                { execute: (i: object) => Promise<{ content: { text: string }[] }> }
              >;
            }
          ).__tools;
          return (await tools[tool as string]?.execute(args as object))?.content[0]?.text ?? '';
        },
        [toolName, input] as const,
      );
    await expect.poll(() => call('list-fonts')).toContain('"fileName"');
    await call('set-audience', { query });
    const cli = readFileSync(fixture(expected), 'utf8');
    await expect
      .poll(async () => difference(await call('get-css'), cli), { timeout: 15_000 })
      .toBe('match');
  });
}
