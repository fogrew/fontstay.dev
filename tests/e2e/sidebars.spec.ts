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
