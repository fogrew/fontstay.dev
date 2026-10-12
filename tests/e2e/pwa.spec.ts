import { type ChildProcess, spawn } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { expect, openSupport, test } from './fixtures';

const font = new URL(
  '../fixtures/fonts/SourceSansPro-Regular.woff2',
  import.meta.url,
).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const dist = fileURLToPath(new URL('../../dist', import.meta.url));
const serveScript = fileURLToPath(new URL('./serve.mjs', import.meta.url));

async function controlled(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
}

test('the app works offline after the first visit, including the font parser', async ({
  page,
  context,
}) => {
  await page.goto('/en/');
  await controlled(page);
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(font);
  await expect(page.getByRole('button', { name: /^Remove: SourceSansPro-Regular/ })).toBeVisible();
  await openSupport(page);
  await expect(page.getByRole('region', { name: 'Browser support' })).toBeVisible();

  await page.goto('/ru/fonts/arial/');
  await expect(page.getByRole('heading', { level: 1, name: 'Arial' })).toBeVisible();
  await page.goto('/en/guide/');
  await expect(page.getByRole('heading', { level: 1, name: 'Guide' })).toBeVisible();
  await page.goto('/en/some-unknown-page/');
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
  await context.setOffline(false);
});

test('the manifest is linked and describes an installable app', async ({ page, request }) => {
  await page.goto('/en/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  );
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ display: 'standalone', start_url: '/', scope: '/' });
  const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');
  expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === 'maskable')).toBe(
    true,
  );
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  const worker = await request.get('/sw.js');
  expect(worker.headers()['cache-control']).toContain('no-cache');
});

test.describe('update flow', () => {
  let server: ChildProcess | undefined;
  let directory = '';
  const port = 4977;

  test.beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'fontstay-update-'));
    cpSync(dist, directory, { recursive: true });
    server = spawn(process.execPath, [serveScript, String(port)], {
      env: { ...process.env, DIST_DIR: directory },
      stdio: 'ignore',
    });
    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        const response = await fetch(`http://localhost:${port}/version.json`);
        if (response.ok) return;
      } catch {
        // not listening yet
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('update server did not start');
  });

  test.afterAll(() => {
    server?.kill();
    rmSync(directory, { recursive: true, force: true });
  });

  test('a new version is offered, applied on request and explained in the changelog', async ({
    page,
  }) => {
    const base = `http://localhost:${port}`;
    await page.goto(`${base}/en/`);
    await controlled(page);

    const chunks = join(directory, '_astro');
    for (const name of readdirSync(chunks)) {
      const path = join(chunks, name);
      if (!name.endsWith('.js')) continue;
      const text = readFileSync(path, 'utf8');
      if (text.includes('fontstay:version'))
        writeFileSync(path, text.replaceAll('`0.0.0`', '`9.9.9`'));
    }
    const worker = readFileSync(join(directory, 'sw.js'), 'utf8');
    writeFileSync(
      join(directory, 'sw.js'),
      worker.replace(/const BUILD = '[^']*'/, "const BUILD = 'patched'"),
    );
    writeFileSync(join(directory, 'version.json'), '{"version":"9.9.9","build":"patched"}\n');

    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()));
    const toast = page.getByRole('status').filter({ hasText: 'Version 9.9.9 is available.' });
    await expect(toast).toBeVisible({ timeout: 20_000 });
    await expect(toast.getByRole('link', { name: 'Changelog' })).toHaveAttribute(
      'href',
      '/en/changelog/?since=0.0.0',
    );

    await toast.getByRole('button', { name: 'Update' }).click();
    const updated = page.getByRole('status').filter({ hasText: 'updated from 0.0.0 to 9.9.9' });
    await expect(updated).toBeVisible({ timeout: 20_000 });
    await expect(updated.getByRole('link', { name: 'What is new' })).toHaveAttribute(
      'href',
      '/en/changelog/?since=0.0.0',
    );
    await updated.getByRole('button', { name: 'Dismiss' }).click();
    await expect(updated).toHaveCount(0);
  });
});

test('the changelog page can show only the changes since a version', async ({ page }) => {
  await page.goto('/en/changelog/?since=0.0.0');
  await expect(page.getByRole('heading', { level: 1, name: 'Changelog' })).toBeVisible();
  await expect(page.getByText('Showing the changes since version 0.0.0.')).toBeVisible();
  await page.getByRole('button', { name: 'Show all versions' }).click();
  await expect(page.getByText('Showing the changes since version 0.0.0.')).toHaveCount(0);
});
