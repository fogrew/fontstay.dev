import { expect, LOCALES, test, waitForGenerator } from './fixtures';

const fonts = new URL('../fixtures/fonts/', import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  '$1',
);
const sourceSans = `${fonts}SourceSansPro-Regular.woff2`;
const WIDTHS = [320, 390, 768, 1024, 1440];

for (const locale of LOCALES) {
  test(`the preview toolbar stays on one row at every width in ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/${locale}/`);
    await waitForGenerator(page);
    await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
    const toolbar = page.locator('.ff-article-view__controls');
    await expect(toolbar).toBeVisible({ timeout: 20_000 });
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await expect(async () => {
        const rows = await toolbar.evaluate((element) => {
          const tops = new Set<number>();
          for (const child of Array.from(element.children)) {
            const box = child.getBoundingClientRect();
            if (box.width > 0) tops.add(Math.round(box.top + box.height / 2));
          }
          return { tops: [...tops], overflow: element.scrollWidth - element.clientWidth };
        });
        expect(rows.tops.length, `${width}px`).toBe(1);
        expect(rows.overflow, `${width}px`).toBeLessThanOrEqual(0);
      }).toPass({ timeout: 5000 });
    }
  });
}

test('toolbar icon buttons have names, 24 px targets and a centred arrange group', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  const toolbar = page.locator('.ff-article-view__controls');
  await expect(toolbar).toBeVisible({ timeout: 20_000 });
  for (const name of ['Emulation', 'Settings', 'Share', 'Forget']) {
    const button = toolbar.getByRole(name === 'Emulation' ? 'combobox' : 'button', {
      name,
      exact: true,
    });
    await expect(button).toHaveAttribute('title', name);
    const box = await button.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(24);
    expect(box?.height).toBeGreaterThanOrEqual(24);
  }
  const arrange = toolbar.locator('.ff-preview__arrange-button');
  const [first, second] = await arrange.evaluateAll((buttons) =>
    buttons.map((button) => {
      const icon = button.querySelector('.ff-arrange-icon')?.getBoundingClientRect();
      const box = button.getBoundingClientRect();
      return icon ? Math.abs(icon.top + icon.height / 2 - (box.top + box.height / 2)) : 99;
    }),
  );
  expect(first).toBeLessThanOrEqual(1);
  expect(second).toBeLessThanOrEqual(1);
});

test('the view tools move into the More tools menu on a narrow toolbar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  const toolbar = page.locator('.ff-article-view__controls');
  await expect(toolbar).toBeVisible({ timeout: 20_000 });
  const more = toolbar.getByRole('button', { name: 'More tools' });
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.click();
  await expect(toolbar.getByRole('button', { name: 'Overlay' })).toBeVisible();
  await expect(toolbar.getByRole('combobox', { name: 'Emulation' })).toBeVisible();
});
