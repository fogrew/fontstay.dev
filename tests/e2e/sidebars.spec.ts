import type { Locator, Page } from '@playwright/test';
import { expect, test, waitForGenerator } from './fixtures';

test.use({ viewport: { width: 1400, height: 900 } });

const widthOf = async (locator: Locator) => Math.round((await locator.boundingBox())?.width ?? 0);

async function drag(page: Page, handle: Locator, deltaX: number) {
  const box = await handle.boundingBox();
  if (!box) throw new Error('splitter is not visible');
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(box.height / 2, 300);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + deltaX / 2, y, { steps: 4 });
  await page.mouse.move(x + deltaX, y, { steps: 4 });
  await page.mouse.up();
}

const left = (page: Page) => page.getByRole('separator', { name: 'Resize the side panel' });
const right = (page: Page) => page.getByRole('separator', { name: 'Resize the settings panel' });

test('the left splitter resizes, collapses and restores the saved width', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  const dock = page.locator('#ff-dock');
  const toggle = page.getByRole('button', { name: 'Side panel' });
  const splitter = left(page);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(splitter).toHaveAttribute('aria-valuenow', '352');

  await drag(page, splitter, 100);
  await expect(splitter).toHaveAttribute('aria-valuenow', '452');
  expect(await widthOf(dock)).toBe(452);

  await drag(page, splitter, -1000);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(dock).toBeHidden();
  await expect(splitter).toHaveAttribute('aria-valuenow', '0');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(await widthOf(dock)).toBe(452);

  await page.reload();
  await waitForGenerator(page);
  expect(await widthOf(dock)).toBe(452);
  await expect(splitter).toHaveAttribute('aria-valuenow', '452');
});

test('the left splitter works from the keyboard and resets on a double click', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  const splitter = left(page);
  await splitter.focus();
  await page.keyboard.press('ArrowRight');
  await expect(splitter).toHaveAttribute('aria-valuenow', '368');
  await page.keyboard.press('Shift+ArrowLeft');
  await expect(splitter).toHaveAttribute('aria-valuenow', '304');
  await page.keyboard.press('Home');
  await expect(page.locator('#ff-dock')).toBeHidden();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#ff-dock')).toBeVisible();
  await page.keyboard.press('End');
  await expect(splitter).toHaveAttribute('aria-valuenow', '630');
  await splitter.dblclick();
  await expect(splitter).toHaveAttribute('aria-valuenow', '352');
});

test('the settings sidebar is collapsed, opens on a click and keeps its state', async ({
  page,
}) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  const toggle = page.getByRole('button', { name: 'Settings', exact: true });
  const aside = page.getByRole('complementary', { name: 'Settings' });
  const splitter = right(page);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(aside).toBeHidden();

  const box = await splitter.boundingBox();
  if (!box) throw new Error('splitter is not visible');
  await page.mouse.click(box.x + box.width / 2, box.y + 40);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(aside).toBeVisible();
  expect(await widthOf(aside)).toBe(352);
  await expect(aside.getByRole('button', { name: 'Fonts', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true',
  );

  await drag(page, splitter, -80);
  await expect(splitter).toHaveAttribute('aria-valuenow', '432');
  await page.reload();
  await waitForGenerator(page);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(await widthOf(aside)).toBe(432);

  await toggle.click();
  await expect(aside).toBeHidden();
  await toggle.click();
  expect(await widthOf(aside)).toBe(432);

  await drag(page, splitter, 1000);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

for (const locale of ['en', 'ar']) {
  test(`both sidebars align and the settings toggle follows Share and Reset in ${locale}`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/`);
    await waitForGenerator(page);
    const toolbar = page.locator('.ff-article-view__controls');
    const settingsToggle = toolbar.locator('.ff-toolbar__settings-toggle');
    await settingsToggle.click();

    const dock = await page.locator('#ff-dock').boundingBox();
    const settings = await page.locator('#ff-article-settings').boundingBox();
    expect(dock).not.toBeNull();
    expect(settings).not.toBeNull();
    expect(Math.abs((dock?.y ?? 0) - (settings?.y ?? 0))).toBeLessThanOrEqual(1);

    const order = await toolbar
      .locator('button')
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('class') ?? ''));
    expect(order.at(-1)).toContain('ff-toolbar__settings-toggle');
    await expect(toolbar.locator('.ff-share button')).toHaveCount(2);
    await expect(page.locator('.ff-toolbar__panel-toggle svg rect')).toHaveCount(1);
  });
}

const chevrons = (toggles: Locator) =>
  toggles.evaluateAll((buttons) =>
    buttons.map((button) => {
      const style = getComputedStyle(button);
      const chevron = getComputedStyle(button, '::before');
      const rtl = style.direction === 'rtl';
      const box = button.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(button);
      const rects = [...range.getClientRects()];
      const titleEnd = rtl
        ? box.right - Math.min(...rects.map((rect) => rect.left))
        : Math.max(...rects.map((rect) => rect.right)) - box.left;
      const start =
        titleEnd +
        Number.parseFloat(style.columnGap) +
        Number.parseFloat(chevron.marginInlineStart);
      const end = start + Number.parseFloat(chevron.width);
      const inset =
        Number.parseFloat(style.paddingInlineEnd) + Number.parseFloat(style.borderInlineEndWidth);
      return {
        glyph: chevron.content.charAt(1),
        expanded: button.getAttribute('aria-expanded') === 'true',
        afterTitle: chevron.order === '1' && start > titleEnd,
        offEnd: Math.abs(box.width - inset - end),
      };
    }),
  );

for (const [locale, closed] of [
  ['en', '▸'],
  ['ar', '◂'],
] as const) {
  test(`dock chevrons sit at the inline-end edge of every header in ${locale}`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/`);
    await waitForGenerator(page);
    await page.locator('.ff-toolbar__settings-toggle').click();
    for (const sidebar of ['#ff-dock', '#ff-article-settings']) {
      const toggles = page.locator(`${sidebar} .ff-dock__toggle`);
      await expect(toggles.first()).toBeVisible();
      const headers = await chevrons(toggles);
      expect(headers.length).toBeGreaterThan(1);
      for (const header of headers) {
        expect(header.glyph).toBe(header.expanded ? '▾' : closed);
        expect(header.afterTitle).toBe(true);
        expect(header.offEnd).toBeLessThan(2);
      }
    }
  });
}

test('the phone layout stacks the panels without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/en/');
  await waitForGenerator(page);
  await expect(left(page)).toBeHidden();
  await expect(page.getByRole('button', { name: 'Side panel' })).toBeHidden();
  const toggle = page.getByRole('button', { name: 'Settings', exact: true });
  await toggle.click();
  await expect(page.getByRole('complementary', { name: 'Settings' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('the settings sidebar keeps one panel open, joined to its header, across a reload', async ({
  page,
}) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const aside = page.getByRole('complementary', { name: 'Settings' });
  const text = aside.getByRole('button', { name: 'Text and layout' });
  await text.click();
  const panel = aside.locator('.ff-dock__panel:not([hidden])');
  await expect(panel).toHaveCount(1);
  const header = await text.boundingBox();
  const body = await panel.boundingBox();
  expect(Math.abs((header?.y ?? 0) + (header?.height ?? 0) - (body?.y ?? 99))).toBeLessThan(1);
  await expect(text).toHaveCSS('border-end-start-radius', '0px');
  await expect(panel).toHaveCSS('border-start-start-radius', '0px');

  await page.reload();
  await waitForGenerator(page);
  await expect(text).toHaveAttribute('aria-expanded', 'true');
  await expect(panel).toHaveCount(1);
});

const font = new URL(
  '../fixtures/fonts/SourceSansPro-Regular.woff2',
  import.meta.url,
).pathname.replace(/^\/([A-Za-z]:)/, '$1');

test('the font features panel stays chosen across a reload, once its font is back', async ({
  page,
}) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(font);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const features = page
    .getByRole('complementary', { name: 'Settings' })
    .getByRole('button', { name: 'Font features and axes' });
  await features.click();
  await expect(features).toHaveAttribute('aria-expanded', 'true');

  await page.reload();
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(font);
  await expect(features).toHaveAttribute('aria-expanded', 'true');
});

test('a short window keeps the open settings panel usable', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 340 });
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const aside = page.getByRole('complementary', { name: 'Settings' });
  await aside.getByRole('button', { name: 'Background image' }).click();
  const panel = aside.locator('.ff-dock__panel:not([hidden])');
  await panel.scrollIntoViewIfNeeded();
  expect((await panel.boundingBox())?.height ?? 0).toBeGreaterThan(100);
});
