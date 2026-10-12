import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

const fontFile = new URL(
  '../fixtures/fonts/SourceSansPro-Regular.woff2',
  import.meta.url,
).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const pages = ['/', '/fonts/', '/fonts/arial/', '/presets/', '/guide/', '/credits/'];

for (const scheme of ['light', 'dark'] as const) {
  test(`${scheme} scheme: every page has no axe violations`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    for (const locale of ['en', 'ru']) {
      for (const path of pages) {
        await page.goto(`/${locale}${path}`);
        await page.waitForLoadState('networkidle');
        const results = await new AxeBuilder({ page }).withTags(tags).analyze();
        expect(results.violations, `${locale}${path}`).toEqual([]);
      }
    }
  });

  test(`${scheme} scheme: the generator with every section open has no axe violations`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/en/');
    await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
    await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(fontFile);
    for (const name of ['Glyph coverage', 'Export']) {
      await page.getByRole('button', { name, exact: true }).click();
    }
    for (const summary of [
      'Spacing while fonts load',
      'Import from CSS',
      'Google Fonts',
      'Save and share',
    ]) {
      await page.getByText(summary, { exact: false }).first().click();
    }
    await page.waitForTimeout(1500);
    const results = await new AxeBuilder({ page }).withTags(tags).analyze();
    expect(results.violations).toEqual([]);
  });
}

test('the pages reflow at 320 px without horizontal page scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const locale of ['en', 'ru']) {
    for (const path of pages) {
      await page.goto(`/${locale}${path}`);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${locale}${path}`).toBeLessThanOrEqual(0);
    }
  }
});

test('the generator reflows at 320 px with a font loaded', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(fontFile);
  await page.waitForTimeout(1500);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('keyboard users can reach the main controls and open the sections', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(fontFile);
  const section = page.getByRole('button', { name: 'Browser support', exact: true });
  await section.focus();
  await expect(section).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Enter');
  await expect(section).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Space');
  await expect(section).toHaveAttribute('aria-expanded', 'true');
  for (const name of [/^Remove: /]) await expect(page.getByRole('button', { name })).toBeVisible();
});

test('forced colors keeps the support states distinguishable by text', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(fontFile);
  const matrix = page.getByRole('region', { name: 'Browser support' });
  await expect(matrix.getByText('Fully adjusted').first()).toBeVisible();
  await expect(matrix.locator('[data-state]').first()).toBeVisible();
});
