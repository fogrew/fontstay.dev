import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type BrowserContext, chromium, expect, test } from '@playwright/test';

const root = fileURLToPath(new URL('../../', import.meta.url));
function prepareExtension(origin: string): string {
  const target = mkdtempSync(join(tmpdir(), 'fontstay-extension-'));
  cpSync(`${root}extension`, target, { recursive: true });
  const manifest = JSON.parse(readFileSync(join(target, 'manifest.json'), 'utf8'));
  manifest.host_permissions = ['https://site.test/*'];
  manifest.content_scripts[0].matches = [`${origin}/*/import/*`];
  const background = readFileSync(join(target, 'background.js'), 'utf8');
  writeFileSync(join(target, 'background.js'), background.replace('https://fontstay.dev', origin));
  writeFileSync(join(target, 'manifest.json'), JSON.stringify(manifest));
  return target;
}
const font = readFileSync(`${root}tests/fixtures/fonts/SourceSansPro-Regular.woff2`);

const DEMO_SITE = `<!doctype html><title>Demo site</title>
<style>
@font-face { font-family: "Demo Sans"; src: url(/font.woff2) format("woff2"); }
body { font-family: "Demo Sans", sans-serif; font-size: 17px; }
</style>
<h1>Hello from the demo site</h1>
<p>This paragraph is long enough to be taken as the body text sample of the page.</p>`;

let context: BrowserContext | undefined;

test.afterEach(async () => {
  await context?.close();
  context = undefined;
});

test('the extension sends the page to the import page of fontstay.dev', async ({ baseURL }) => {
  test.setTimeout(90_000);
  const extension = prepareExtension(baseURL ?? '');
  context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  await context.addInitScript(() => {
    localStorage.setItem(
      'fontstay:layout:dock',
      JSON.stringify({ sizes: {}, opened: ['inputs', 'tuning', 'export'] }),
    );
  });
  await context.route('https://site.test/**', (route) => {
    const isFont = new URL(route.request().url()).pathname === '/font.woff2';
    return route.fulfill({
      status: 200,
      headers: { 'content-type': isFont ? 'font/woff2' : 'text/html' },
      body: isFont ? font : DEMO_SITE,
    });
  });
  const ctx = context;
  const readyWorker = async () => {
    const [worker] = ctx.serviceWorkers();
    if (!worker) return null;
    const ready = await worker
      .evaluate(() => typeof (globalThis as { fontstaySend?: unknown }).fontstaySend)
      .catch(() => null);
    return ready === 'function' ? worker : null;
  };
  await expect.poll(async () => (await readyWorker()) !== null, { timeout: 30_000 }).toBe(true);
  const page = await context.newPage();
  await page.goto('https://site.test/');
  await page.bringToFront();
  const opened = context.waitForEvent('page');
  const worker = await readyWorker();
  if (!worker) throw new Error('extension service worker is not ready');
  await worker.evaluate(async () => {
    const scope = globalThis as unknown as {
      chrome: { tabs: { query: (query: object) => Promise<unknown[]> } };
      fontstaySend: (tab: unknown) => Promise<void>;
    };
    const [tab] = await scope.chrome.tabs.query({ active: true, currentWindow: true });
    await scope.fontstaySend(tab);
  });
  const generator = await opened;
  const confirm = generator.getByRole('region', { name: 'Import from https://site.test?' });
  await expect(confirm).toBeVisible({ timeout: 20_000 });
  await expect(confirm).toContainText('1 font files');
});

test('the extensions page offers the bookmarklet without inline handlers', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/en/extensions/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Browser extension and bookmarklet',
  );
  const link = page.getByRole('link', { name: 'Send to fontstay' });
  await expect(link).toHaveAttribute('href', /^javascript:/);
  await expect(link).not.toHaveAttribute('onclick', /.*/);
  await page.getByRole('button', { name: 'Copy the bookmarklet code' }).click();
  await expect(page.getByRole('status')).toContainText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^javascript:/);
});
