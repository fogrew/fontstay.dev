import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, openStep, test, waitForGenerator } from './fixtures';

const fonts = 'tests/fixtures/fonts/';
const cors = { 'access-control-allow-origin': '*' };

const mockGoogle = async (page: Page) => {
  const requested: string[] = [];
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({
      status: 200,
      headers: { ...cors, 'content-type': 'text/css' },
      body: ['cyrillic', 'latin']
        .map(
          (subset) =>
            `/* ${subset} */\n@font-face { font-family: "Montserrat"; src: url(https://fonts.gstatic.com/s/m/${subset}.woff2) format("woff2"); }`,
        )
        .join('\n'),
    }),
  );
  await page.route('https://fonts.gstatic.com/**', (route) => {
    requested.push(new URL(route.request().url()).pathname);
    return route.fulfill({
      status: 200,
      headers: { ...cors, 'content-type': 'font/woff2' },
      body: readFileSync(`${fonts}SourceSansPro-Regular.woff2`),
    });
  });
  return requested;
};

const open = async (page: Page, locale: string) => {
  await page.goto(`/${locale}/`);
  await waitForGenerator(page);
  await openStep(page, 'inputs');
};

const choose = async (page: Page, family: string) => {
  await page.locator('#ff-input-text').fill(family);
  await page
    .locator('.ff-source__name', { has: page.getByText(family, { exact: true }) })
    .first()
    .click();
};

const subset = (page: Page, name: string) =>
  page.locator('.ff-source__chosen').getByRole('button', { name, exact: true });

test('the Russian page preselects Cyrillic with Latin and downloads both', async ({ page }) => {
  const requested = await mockGoogle(page);
  await open(page, 'ru');
  await choose(page, 'Montserrat');
  await expect(subset(page, 'latin')).toHaveAttribute('aria-pressed', 'true');
  await expect(subset(page, 'cyrillic')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Для вашего языка заранее выбран набор: кириллица')).toBeVisible();
  await expect(page.locator('.ff-source__script').first()).toBeVisible();
  const results = await new AxeBuilder({ page }).include('.ff-source').analyze();
  expect(results.violations).toEqual([]);
  await page.locator('.ff-source__add button').click();
  await expect.poll(() => requested.sort()).toEqual(['/s/m/cyrillic.woff2', '/s/m/latin.woff2']);
});

test('a deselected Cyrillic stays deselected for the next family', async ({ page }) => {
  await mockGoogle(page);
  await open(page, 'ru');
  await choose(page, 'Montserrat');
  await subset(page, 'cyrillic').click();
  await expect(page.getByText('заранее выбран набор')).toHaveCount(0);
  await choose(page, 'Roboto');
  await expect(subset(page, 'cyrillic')).toHaveAttribute('aria-pressed', 'false');
});

test('a family without the script is explained, and English keeps Latin only', async ({ page }) => {
  await open(page, 'ru');
  await choose(page, 'Poppins');
  await expect(page.getByText('нет набора: кириллица')).toBeVisible();
  await open(page, 'en');
  await choose(page, 'Montserrat');
  await expect(subset(page, 'latin')).toHaveAttribute('aria-pressed', 'true');
  await expect(subset(page, 'cyrillic')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.ff-source__script')).toHaveCount(0);
});

test('a loaded font without the script is reported', async ({ page }) => {
  await open(page, 'ru');
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(`${fonts}Mada-VF.woff2`);
  await expect(page.getByText('Не покрывают набор «кириллица»: Mada')).toBeVisible();
});

test('the fallback faces of two subset files do not override each other', async ({ page }) => {
  await mockGoogle(page);
  await open(page, 'ru');
  await choose(page, 'Montserrat');
  await page.locator('.ff-source__add button').click();
  await openStep(page, 'export');
  const css = page.locator('#ff-dock pre').first();
  await expect(css).toContainText('Fallback');
  await expect
    .poll(async () => {
      const rules = (await css.textContent())?.match(/@font-face \{[^}]*local\([^}]*\}/g) ?? [];
      return rules.length > 0 && rules.every((rule) => rule.includes('unicode-range'));
    })
    .toBe(true);
});
