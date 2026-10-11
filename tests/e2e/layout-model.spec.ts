import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createViteServer } from 'vitest/node';
import { expect, test } from './fixtures';

const fonts = new URL('../fixtures/fonts/', import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  '$1',
);
const sourceSans = `${fonts}SourceSansPro-Regular.woff2`;

test.skip(process.platform !== 'win32', 'compares the model with Windows fonts installed here');

interface Viewport {
  width: number;
  height: number;
}

test('the layout model agrees with the browser measurement', async ({ page }) => {
  const server = await createViteServer({
    root: fileURLToPath(new URL('../../', import.meta.url)),
    appType: 'custom',
    resolve: { alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) } },
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true },
  });
  const load = (path: string) => server.ssrLoadModule(path);
  const { adjustmentOf } = await load('/src/modules/generator/lib/css.ts');
  const { fallbackPredictFont, webPredictFont } = await load(
    '/src/modules/generator/lib/predict-input.ts',
  );
  const { rankFor } = await load('/src/modules/generator/lib/per-os.ts');
  const { parseFontBuffer } = await load('/src/modules/font-metrics/lib/parse.ts');
  const { DEFAULT_VIEWPORTS, predictViewport, sampleBlocks } = await load(
    '/src/modules/layout-shift/index.ts',
  );
  await server.close();

  const bytes = readFileSync(sourceSans);
  const web = parseFontBuffer(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  const ranking = rankFor(web, 'windows', 'en');
  const arial = ranking.candidates.find((item: { id: string }) => item.id === 'arial');
  if (!arial) throw new Error('Arial is missing');
  const predict = (sizeAdjust?: number) =>
    DEFAULT_VIEWPORTS.map((viewport: Viewport) =>
      predictViewport(
        webPredictFont(web, ranking),
        fallbackPredictFont(
          arial,
          adjustmentOf(arial.adjustment, sizeAdjust ? { sizeAdjust } : {}),
          { letter: 0, word: 0 },
        ),
        sampleBlocks('en'),
        viewport,
      ),
    );

  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await page.getByLabel('System', { exact: true }).selectOption('windows');
  await page.getByLabel('Fallback font 1', { exact: true }).selectOption('arial');
  const section = page.getByRole('region', { name: 'Layout shift' });

  const measure = async () => {
    await page.getByRole('tab', { name: 'Layout shift' }).click();
    await section.getByRole('button', { name: 'Verify on this device' }).click();
    const message = section.getByText(/Measured in the browser/);
    await expect(message).toBeVisible({ timeout: 25_000 });
    const text = await message.innerText();
    return [...text.matchAll(/(\d+)px: (\d+(?:\.\d+)?)/g)].map((match) => Number(match[2]));
  };

  const good = await measure();
  for (const [index, item] of predict().entries()) {
    expect(Math.abs(item.score - (good[index] ?? Number.NaN))).toBeLessThan(0.02);
  }

  const size = page.getByRole('spinbutton', { name: /Size adjust/ });
  await size.fill('140');
  await size.press('Enter');
  const bad = await measure();
  for (const [index, item] of predict(1.4).entries()) {
    expect(Math.abs(item.score - (bad[index] ?? Number.NaN))).toBeLessThan(0.05);
    expect(item.score).toBeGreaterThan(0.1);
  }
});
