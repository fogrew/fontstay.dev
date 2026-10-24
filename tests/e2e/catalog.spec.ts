import AxeBuilder from '@axe-core/playwright';
import { choose, expect, fillQuery, test, waitForGenerator } from './fixtures';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const locale of ['en', 'ru', 'ar']) {
  test(`${locale}: the catalog and a font page have no accessibility violations`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/fonts/`);
    await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
    await expect(page.getByRole('table')).toBeVisible();
    let results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
    expect(results.violations).toEqual([]);

    await page.goto(`/${locale}/fonts/arial/`);
    await expect(page.getByRole('heading', { level: 1, name: 'Arial' })).toBeVisible();
    results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
    expect(results.violations).toEqual([]);
  });
}

test('the catalog table sorts and links to the font pages', async ({ page }) => {
  await page.goto('/en/fonts/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  const table = page.getByRole('table', { name: 'System fonts by operating system' });
  const names = async () => table.locator('tbody th a').allInnerTexts();
  const ascending = await names();
  expect([...ascending].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))).toEqual(
    ascending,
  );

  const fontHeader = table.getByRole('columnheader', { name: 'Font' });
  await fontHeader.getByRole('button').click();
  await expect(fontHeader).toHaveAttribute('aria-sort', 'descending');
  expect(await names()).toEqual([...ascending].reverse());

  const windows = table.getByRole('columnheader', { name: 'Windows' });
  await windows.getByRole('button').click();
  await expect(windows).toHaveAttribute('aria-sort', 'descending');
  await expect(table.locator('tbody tr').first().locator('td[data-level]').nth(0)).toHaveAttribute(
    'data-level',
    'preinstalled',
  );

  await table.getByRole('link', { name: 'Georgia' }).click();
  await expect(page).toHaveURL(/\/en\/fonts\/georgia\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Georgia' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Metrics' })).toBeVisible();
});

test('the coverage column follows the audience settings', async ({ page }) => {
  await page.goto('/en/fonts/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  const row = page.getByRole('row', { name: /^Arial/ });
  await expect(row.getByRole('cell').last()).not.toHaveText('0%');
  await page.getByText('Audience (browsers)').click();
  await fillQuery(page, 'and_chr >= 100');
  await expect(row.getByRole('cell').last()).toHaveText('0%');
});

test('the header navigation marks the current page', async ({ page }) => {
  await page.goto('/en/fonts/');
  await expect(
    page.getByRole('navigation', { name: 'Main' }).locator('a[aria-current="page"]'),
  ).toHaveText('System fonts');
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Generator' })
    .click();
  await expect(page).toHaveURL(/\/en\/$/);
});

for (const locale of ['en', 'ru', 'ar']) {
  test(`${locale}: the presets page has no accessibility violations`, async ({ page }) => {
    await page.goto(`/${locale}/presets/`);
    await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
    expect(results.violations).toEqual([]);
  });
}

test('a preset opens in the generator with its type and per-system fallbacks', async ({ page }) => {
  await page.goto('/en/presets/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  const item = page.locator('li', { has: page.getByRole('heading', { name: 'Classic serif' }) });
  await expect(item.getByRole('region', { name: 'Font stack: Classic serif' })).toContainText(
    '"Times New Roman", Georgia',
  );
  await item.getByRole('link', { name: 'Open in the generator' }).click();
  await expect(page).toHaveURL(/\/en\/(#s=.*)?$/);
  await waitForGenerator(page);
  const font = new URL(
    '../fixtures/fonts/SourceSansPro-Regular.woff2',
    import.meta.url,
  ).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(font);
  await expect(page.getByLabel('Font type')).toHaveAttribute('data-value', 'serif', {
    timeout: 15_000,
  });
  const windows = page.getByRole('button', { name: /^Windows/ });
  if ((await windows.getAttribute('aria-expanded')) === 'false') await windows.click();
  await expect(page.getByLabel('Fallback font 1', { exact: true })).toContainText(
    'Times New Roman',
  );
});

for (const locale of ['en', 'ru', 'ar']) {
  test(`${locale}: the guide and credits pages have no accessibility violations`, async ({
    page,
  }) => {
    for (const path of ['guide', 'credits']) {
      await page.goto(`/${locale}/${path}/`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
      expect(results.violations).toEqual([]);
    }
  });
}

test('the guide shows descriptor support and the credits page renders CREDITS.md', async ({
  page,
}) => {
  await page.goto('/en/guide/');
  const table = page.getByRole('table', { name: /First browser version/ });
  await expect(table.getByRole('row', { name: /^size-adjust \d/ })).toContainText('92');
  await expect(table.getByRole('row', { name: /^ascent-override/ })).toContainText('—');
  await page.goto('/en/credits/');
  await expect(page.getByRole('heading', { level: 1, name: 'Credits' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Fallback Font Generator' })).toBeVisible();
  await page.getByRole('contentinfo').getByRole('link', { name: 'Guide' }).click();
  await expect(page).toHaveURL(/\/en\/guide\/$/);
});

test('the catalog table filters by every column and groups by type', async ({ page }) => {
  await page.goto('/en/fonts/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  const table = page.getByRole('table', { name: 'System fonts by operating system' });
  const names = async () => table.locator('tbody th a').allInnerTexts();
  const all = await names();
  await page.getByLabel('Filter by font name').fill('arial');
  const filtered = await names();
  expect(filtered.length).toBeGreaterThan(0);
  expect(filtered.length).toBeLessThan(all.length);
  expect(filtered.every((name) => name.toLowerCase().includes('arial'))).toBe(true);
  await page.getByRole('button', { name: 'Reset filters' }).click();
  expect(await names()).toEqual(all);

  await choose(page.getByLabel('Filter by type'), 'monospace');
  const mono = await names();
  expect(mono.length).toBeLessThan(all.length);
  await choose(page.getByLabel('Filter by availability on Windows'), 'preinstalled');
  expect((await names()).length).toBeLessThanOrEqual(mono.length);
  await page.getByRole('button', { name: 'Reset filters' }).click();

  await page.getByLabel('Group by type').check();
  await expect(table.getByRole('columnheader', { name: /^Serif \(\d+\)$/ })).toBeVisible();
});

test('a preset stays applied to every uploaded font until it is cleared', async ({ page }) => {
  await page.goto('/en/presets/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  const item = page.locator('li', { has: page.getByRole('heading', { name: 'Classic serif' }) });
  await item.getByRole('link', { name: 'Open in the generator' }).click();
  await waitForGenerator(page);
  const fonts = new URL('../fixtures/fonts/', import.meta.url).pathname.replace(
    /^\/([A-Za-z]:)/,
    '$1',
  );
  await page
    .locator('input[type="file"][accept*="woff2"]')
    .setInputFiles([`${fonts}SourceSansPro-Regular.woff2`, `${fonts}FiraSans-Regular.ttf`]);
  await expect(page.getByText('Stack preset applied: Classic serif')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Generated CSS', includeHidden: true }),
  ).toContainText('serif;', {
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'Clear the preset' }).click();
  await expect(page.getByText('Stack preset applied: Classic serif')).toHaveCount(0);
});
