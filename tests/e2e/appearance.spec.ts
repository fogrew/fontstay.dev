import AxeBuilder from '@axe-core/playwright';
import { expect, LOCALES, openExport, test, waitForGenerator } from './fixtures';

test('theme and vision choices persist before first paint', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'fontstay:appearance',
      JSON.stringify({
        theme: 'dark',
        vision: 'deuteranopia',
        contrast: true,
        motion: true,
        spacing: true,
        largeText: true,
      }),
    );
  });
  await page.goto('/en/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-vision', 'deuteranopia');
  await expect(page.locator('html')).toHaveAttribute('data-contrast', '');
  await expect(page.locator('html')).toHaveAttribute('data-motion', '');
  const menu = page.locator('[data-appearance-menu]');
  await menu.locator('summary').click();
  await expect(menu.getByRole('radio', { name: 'Dark' })).toBeChecked();
  await expect(menu.getByRole('radio', { name: 'Deuteranopia' })).toBeChecked();
  await expect(menu.getByRole('checkbox', { name: 'High contrast' })).toBeChecked();
  await expect(page.locator('.ff-appearance-surface')).toHaveCSS('filter', 'none');
  expect(
    await page.evaluate(() => getComputedStyle(document.body, '::after').backdropFilter),
  ).toContain('#ff-deuteranopia');
  await expect(menu.locator('summary')).toHaveCSS('filter', 'none');
});

test('appearance changes and resets with keyboard controls', async ({ page }) => {
  await page.goto('/en/');
  const menu = page.locator('[data-appearance-menu]');
  await menu.locator('summary').focus();
  await page.keyboard.press('Enter');
  await menu.getByRole('radio', { name: 'Light' }).check();
  await menu.getByRole('radio', { name: 'Protanopia' }).check();
  await menu.getByRole('checkbox', { name: 'Increase text spacing' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveAttribute('data-vision', 'protanopia');
  await expect(page.locator('html')).toHaveAttribute('data-spacing', '');
  await menu.getByRole('radio', { name: 'System' }).check();
  await menu.getByRole('radio', { name: 'None' }).check();
  await menu.getByRole('checkbox', { name: 'Increase text spacing' }).uncheck();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  await expect(page.locator('html')).not.toHaveAttribute('data-vision');
  await page.keyboard.press('Escape');
  await expect(menu).toHaveJSProperty('open', false);
  await expect(menu.locator('summary')).toBeFocused();
});

test('appearance joins the one-open-menu behavior and preserves navigation fit', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 700 });
  await page.goto('/en/');
  const menu = page.locator('[data-appearance-menu]');
  const more = page.locator('[data-more-menu]');
  const language = page.locator('[data-locale-menu]');
  await more.locator('summary').click();
  await menu.locator('summary').click();
  await expect(more).toHaveJSProperty('open', false);
  await language.locator('summary').click();
  await expect(menu).toHaveJSProperty('open', false);
  await expect.poll(() => page.locator('[data-more-list] > li').count()).toBeGreaterThan(0);
});

for (const locale of LOCALES) {
  test(`${locale}: appearance menu fits a phone and has accessible controls`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(`/${locale}/`);
    await page.locator('[data-appearance-menu] > summary').click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

test('saved appearance does not shift the phone layout during loading', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.addInitScript(() => {
    localStorage.setItem(
      'fontstay:appearance',
      JSON.stringify({
        theme: 'dark',
        vision: 'tritanopia',
        contrast: true,
        spacing: true,
        largeText: true,
      }),
    );
    (window as unknown as { __appearanceShifts: number }).__appearanceShifts = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        hadRecentInput: boolean;
        value: number;
      })[]) {
        if (!entry.hadRecentInput)
          (window as unknown as { __appearanceShifts: number }).__appearanceShifts += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('/en/');
  await page.waitForLoadState('networkidle');
  const shift = await page.evaluate(
    () => (window as unknown as { __appearanceShifts: number }).__appearanceShifts,
  );
  expect(shift).toBeLessThanOrEqual(0.001);
});

test('vision simulation keeps fixed option lists aligned and visibly changes content', async ({
  page,
}) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  const before = await page.locator('.ff-main').screenshot();
  const menu = page.locator('[data-appearance-menu]');
  await menu.locator('summary').click();
  await menu.getByRole('radio', { name: 'Achromatopsia (monochrome)' }).check();
  await menu.locator('summary').click();
  const after = await page.locator('.ff-main').screenshot();
  expect(after.equals(before)).toBe(false);

  const font = new URL(
    '../fixtures/fonts/SourceSansPro-Regular.woff2',
    import.meta.url,
  ).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(font);
  await openExport(page);
  const format = page.getByRole('combobox', { name: 'Format' });
  await format.focus();
  await page.keyboard.press('ArrowDown');
  const list = page.locator('.ff-select__list:visible');
  await expect(list).toBeVisible();
  const buttonBox = await format.boundingBox();
  const listBox = await list.boundingBox();
  expect(buttonBox).not.toBeNull();
  expect(listBox).not.toBeNull();
  expect(Math.abs((listBox?.x ?? 0) - (buttonBox?.x ?? 0))).toBeLessThan(5);
});

test('high contrast and text aids keep the page accessible at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.addInitScript(() => {
    localStorage.setItem(
      'fontstay:appearance',
      JSON.stringify({ contrast: true, motion: true, spacing: true, largeText: true }),
    );
  });
  await page.goto('/en/fonts/');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
