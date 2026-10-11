import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const locale of ['en', 'ru']) {
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
  await page.getByLabel('Browserslist query').fill('and_chr >= 100');
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
