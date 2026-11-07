import AxeBuilder from '@axe-core/playwright';
import { expect, test, waitForGenerator } from './fixtures';

const font = new URL(
  '../fixtures/fonts/SourceSansPro-Regular.woff2',
  import.meta.url,
).pathname.replace(/^\/([A-Za-z]:)/, '$1');

test('specimen tabs show waterfall, accessible colour presets and glyph metrics', async ({
  page,
}) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(font);
  const view = page.locator('.ff-article-view');
  await view.getByRole('button', { name: 'Specimen' }).click();
  const specimen = view.getByRole('region', { name: 'Specimen' });
  await expect(specimen).toBeVisible();
  await specimen.getByRole('textbox', { name: 'Sample text' }).fill('Hamburgefonts');
  await expect(specimen.locator('.ff-specimen__sample')).toHaveCount(8);
  await expect(specimen.locator('.ff-specimen__sample').last()).toHaveText('Hamburgefonts');
  await specimen.getByRole('tab', { name: 'Colour' }).click();
  for (const [name, foreground, background] of [
    ['Black on white', 'rgb(23, 23, 23)', 'rgb(255, 255, 255)'],
    ['White on ink', 'rgb(249, 250, 251)', 'rgb(17, 24, 39)'],
    ['Dark on cream', 'rgb(36, 36, 36)', 'rgb(255, 244, 214)'],
    ['White on blue', 'rgb(255, 255, 255)', 'rgb(23, 50, 92)'],
  ] as const) {
    await specimen.getByRole('button', { name }).click();
    await expect(specimen.locator('.ff-specimen__colour-sample')).toHaveCSS('color', foreground);
    await expect(specimen.locator('.ff-specimen__colour-sample')).toHaveCSS(
      'background-color',
      background,
    );
  }
  await specimen.getByRole('tab', { name: 'Glyphs' }).click();
  await specimen.getByRole('button', { name: 'U+0041' }).click();
  await expect(specimen.getByText(/Page 1 of \d+/)).toBeVisible();
  await specimen.getByRole('button', { name: 'Next' }).click();
  await expect(specimen.getByText(/Page 2 of \d+/)).toBeVisible();
  await expect(specimen.getByText('Advance', { exact: true })).toBeVisible();
  await expect(specimen.getByText('Ascender', { exact: true })).toBeVisible();
  await expect(specimen.getByText('Descender', { exact: true })).toBeVisible();
  await expect(specimen.getByRole('img', { name: /Metrics diagram/ })).toBeVisible();
  expect((await new AxeBuilder({ page }).include('.ff-specimen').analyze()).violations).toEqual([]);
});

test('specimen fits a 320 px phone without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.route('**/SpecimenPanel.*.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await page.addInitScript(() => {
    const state = window as unknown as { shifts: number };
    state.shifts = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
      }[]) {
        if (!entry.hadRecentInput) state.shifts += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(font);
  const toggle = page.locator('.ff-article-view').getByRole('button', { name: 'Specimen' });
  await expect(toggle).toBeEnabled();
  await page.evaluate(() => {
    (window as unknown as { shifts: number }).shifts = 0;
  });
  await toggle.click();
  await page.getByRole('tab', { name: 'Glyphs' }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(320);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as unknown as { shifts: number }).shifts)).toBeLessThan(
    0.001,
  );
});
