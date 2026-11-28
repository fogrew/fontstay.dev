import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { choose, expect, test, waitForGenerator } from './fixtures';

const open = async (page: Page, path = '/en/') => {
  await page.goto(path);
  await waitForGenerator(page);
};

const bar = (page: Page) => page.locator('.ff-format-bar');
const level = (page: Page) => bar(page).getByRole('combobox', { name: 'Text level' });
const preview = (page: Page, selector: string) =>
  page.locator(`.ff-article-view__frame ${selector}:not([inert] *)`).first();
const fontSize = (page: Page, selector: string) =>
  preview(page, selector).evaluate((element) => getComputedStyle(element).fontSize);

const setRange = (page: Page, name: string, value: number) =>
  bar(page).getByRole('slider', { name }).fill(String(value));

test('clicking a text block formats every block of its level', async ({ page }) => {
  await open(page);
  await preview(page, '.ff-article__heading').click();
  await expect(bar(page)).toBeVisible();
  await expect(level(page)).toHaveAttribute('data-value', 'heading');

  await setRange(page, 'Text size', 40);
  await setRange(page, 'Line height', 2);
  const sizes = await page
    .locator('.ff-article-view__frame .ff-article__heading')
    .evaluateAll((elements) => elements.map((element) => getComputedStyle(element).fontSize));
  expect(sizes.length).toBeGreaterThan(1);
  expect(new Set(sizes)).toEqual(new Set(['40px']));
  await expect(preview(page, '.ff-article__heading')).toHaveCSS('line-height', '80px');
  expect(await fontSize(page, '.ff-article__lead')).toBe('22.5px');

  await bar(page).getByRole('button', { name: 'Reset level' }).click();
  expect(await fontSize(page, '.ff-article__heading')).toBe('21.6px');
});

test('the body level shares the size with the Text panel', async ({ page }) => {
  await open(page);
  await preview(page, '.ff-article__columns .ff-article__text').click();
  await expect(level(page)).toHaveAttribute('data-value', 'body');
  await setRange(page, 'Text size', 24);
  expect(await fontSize(page, '.ff-article__columns .ff-article__text')).toBe('24px');
  await expect(page.locator('#ff-article-size')).toHaveValue('24');
  await bar(page).getByRole('button', { name: 'Reset level' }).click();
  await expect(page.locator('#ff-article-size')).toHaveValue('18');
});

test('selecting text opens the bar for its level', async ({ page }) => {
  await open(page);
  await preview(page, '.ff-article__lead').evaluate((element) => {
    document.getSelection()?.selectAllChildren(element);
  });
  await expect(level(page)).toHaveAttribute('data-value', 'lead');
});

test('the toolbar button opens it for the keyboard and Escape returns focus', async ({ page }) => {
  await open(page);
  const button = page.getByRole('button', { name: 'Text styles', exact: true });
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(level(page)).toBeFocused();
  await choose(level(page), { label: 'Heading 1' });
  await expect(level(page)).toHaveAttribute('data-value', 'title');

  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(bar(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(bar(page)).toHaveCount(0);
  await expect(button).toBeFocused();
});

test('Escape closes the bar after a click on preview text', async ({ page }) => {
  await open(page);
  await preview(page, '.ff-article__lead').click();
  await expect(bar(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(bar(page)).toHaveCount(0);
});

test('a click outside the preview text closes the bar', async ({ page }) => {
  await open(page);
  await preview(page, '.ff-article__lead').click();
  await expect(bar(page)).toBeVisible();
  await page.locator('.ff-article-view__controls').click({ position: { x: 1, y: 1 } });
  await expect(bar(page)).toHaveCount(0);
});

for (const [locale, scheme, width] of [
  ['en', 'light', 1280],
  ['en', 'dark', 390],
  ['ar', 'light', 320],
  ['ar', 'dark', 1280],
] as const) {
  test(`stays inside the viewport and passes axe: ${locale} ${scheme} ${width}px`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width, height: 760 });
    await open(page, `/${locale}/`);
    await preview(page, '.ff-article__lead').click();
    await expect(bar(page)).toBeVisible();
    await expect(async () => {
      const box = await bar(page).boundingBox();
      expect(box?.x).toBeGreaterThanOrEqual(0);
      expect(box?.y).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(760);
    }).toPass({ timeout: 5000 });
    await page.screenshot({ path: info.outputPath(`format-${locale}-${scheme}-${width}.png`) });
    const results = await new AxeBuilder({ page }).include('.ff-format-bar').analyze();
    expect(results.violations).toEqual([]);
  });
}

test('level formatting is restored from the share link', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page);
  await preview(page, '.ff-article__lead').click();
  await setRange(page, 'Text size', 36);
  await choose(bar(page).getByRole('combobox', { name: 'Text wrapping' }), {
    label: 'Balanced (balance)',
  });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByText(/link was copied/)).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  const other = await context.newPage();
  await other.goto(link);
  await waitForGenerator(other);
  const apply = other.getByRole('button', { name: /apply|open|load/i }).first();
  if (await apply.isVisible()) await apply.click();
  await expect(preview(other, '.ff-article__lead')).toHaveCSS('font-size', '36px');
});

test('offers the font of the level in side by side view', async ({ page }, info) => {
  await open(page);
  await page
    .locator('input[type="file"][accept*="woff2"]')
    .setInputFiles('tests/fixtures/fonts/SourceSansPro-Regular.woff2');
  const side = page.getByRole('button', { name: 'Side by side', exact: true });
  await expect(side).toBeEnabled({ timeout: 20_000 });
  await side.click();
  await preview(page, '.ff-article__heading').click();
  await expect(bar(page).getByRole('combobox', { name: 'Headings font' })).toBeVisible();
  await setRange(page, 'Text size', 32);
  await page.screenshot({ path: info.outputPath('format-side.png') });
});

test('the body size keeps the limits of the Text panel', async ({ page }) => {
  await open(page);
  await preview(page, '.ff-article__columns .ff-article__text').click();
  const slider = bar(page).getByRole('slider', { name: 'Text size' });
  await expect(slider).toHaveAttribute('min', '12');
  await expect(slider).toHaveAttribute('max', '32');
});

test('the bar stays put while a value changes and fits a short viewport', async ({ page }) => {
  await open(page);
  await preview(page, '.ff-article__lead').click();
  const before = await bar(page).boundingBox();
  const slider = await bar(page).getByRole('slider', { name: 'Text size' }).boundingBox();
  if (!slider) throw new Error('no slider');
  await page.mouse.move(slider.x + slider.width / 4, slider.y + slider.height / 2);
  await page.mouse.down();
  await page.mouse.move(slider.x + slider.width, slider.y + slider.height / 2, { steps: 5 });
  expect((await bar(page).boundingBox())?.y).toBe(before?.y);
  await page.mouse.up();

  await page.setViewportSize({ width: 320, height: 256 });
  await expect(async () => {
    const box = await bar(page).boundingBox();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(256);
  }).toPass({ timeout: 5000 });
  const close = bar(page).getByRole('button', { name: 'Close text styles' });
  await close.click();
  await expect(bar(page)).toHaveCount(0);
});
