import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test('CLI export examples cover every format with accessible tabs', async ({ page }) => {
  await page.goto('/en/cli/');
  await expect
    .poll(() => page.locator('astro-island[component-url*="CliExportTabs"]').getAttribute('ssr'))
    .toBeNull();
  const tabs = page.getByRole('tablist', { name: 'Output formats' }).getByRole('tab');
  const formats = [
    'css',
    'variables',
    'tailwind',
    'next',
    'nuxt',
    'astro',
    'wordpress',
    'fontaine',
    'preload',
    'loading',
  ];
  await expect(tabs).toHaveCount(formats.length);
  await tabs.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(tabs.last()).toBeFocused();
  for (const [index, format] of formats.entries()) {
    await tabs.nth(index).click();
    const panel = page.getByRole('tabpanel');
    await expect(panel).toContainText(`--format ${format}`);
    await expect(panel.locator('pre')).toHaveCount(2);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations, format).toEqual([]);
  }
  await expect(page.getByRole('link', { name: 'Set up the MCP server' })).toHaveAttribute(
    'href',
    '/en/mcp/',
  );
});

test('CLI examples fit mobile and desktop layouts', async ({ page }, testInfo) => {
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/en/cli/');
    await expect(page.getByRole('tablist', { name: 'Output formats' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await page.screenshot({ path: testInfo.outputPath(`cli-${width}.png`), fullPage: true });
  }
});
