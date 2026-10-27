import AxeBuilder from '@axe-core/playwright';
import {
  closePanels,
  expect,
  LOCALES,
  openStep,
  openSupport,
  STEPS,
  test,
  waitForGenerator,
} from './fixtures';

const fontFile = new URL(
  '../fixtures/fonts/SourceSansPro-Regular.woff2',
  import.meta.url,
).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const pages = ['/', '/fonts/', '/fonts/arial/', '/presets/', '/guide/', '/credits/'];

for (const scheme of ['light', 'dark'] as const) {
  test(`${scheme} scheme: every page has no axe violations`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: scheme });
    for (const locale of ['en', 'ru', 'ar']) {
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
    test.setTimeout(90_000);
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/en/');
    await waitForGenerator(page);
    await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(fontFile);
    for (const step of Object.keys(STEPS) as (keyof typeof STEPS)[]) {
      await openStep(page, step);
      if (step === 'tuning') {
        await page.getByText('Spacing while fonts load', { exact: false }).first().click();
      }
      await page.waitForTimeout(800);
      const results = await new AxeBuilder({ page }).withTags(tags).analyze();
      expect(results.violations, step).toEqual([]);
    }
    await closePanels(page);
    await page.getByRole('button', { name: 'Glyph coverage', exact: true }).click();
    await page.getByRole('button', { name: 'Browser support', exact: true }).click();
    await page.waitForTimeout(800);
    const details = await new AxeBuilder({ page }).withTags(tags).analyze();
    expect(details.violations, 'details').toEqual([]);
  });
}

test('the pages reflow at 320 px without horizontal page scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const locale of ['en', 'ru', 'ar']) {
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

const ADDED_LOCALES = LOCALES.filter((locale) => !['en', 'ru', 'ar'].includes(locale));

for (const locale of ADDED_LOCALES) {
  test(`${locale}: the pages have no axe violations and reflow at 320 px`, async ({ page }) => {
    test.setTimeout(120_000);
    for (const path of ['/', '/presets/', '/guide/']) {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/${locale}${path}`);
      await page.waitForLoadState('networkidle');
      const results = await new AxeBuilder({ page }).withTags(tags).analyze();
      expect(results.violations, `${locale}${path}`).toEqual([]);
      await page.setViewportSize({ width: 320, height: 700 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${locale}${path}`).toBeLessThanOrEqual(0);
    }
  });
}

test('the generator reflows at 320 px with a font loaded', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(fontFile);
  await page.waitForTimeout(1500);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('the dock columns stack and stay inside the viewport at 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(fontFile);
  const steps = Object.keys(STEPS) as (keyof typeof STEPS)[];
  const columns = page.locator('.ff-dock__column');
  await expect(columns).toHaveCount(steps.length);
  await closePanels(page);
  const tops = await columns.evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect().top),
  );
  expect(tops).toEqual([...tops].sort((a, b) => a - b));
  expect(new Set(tops).size).toBe(steps.length);
  for (const step of steps) {
    await closePanels(page);
    await openStep(page, step);
    const column = page.locator(`.ff-dock__column[data-id="${step}"]`);
    const box = await column.boundingBox();
    expect(box?.x, step).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0), step).toBeLessThanOrEqual(320);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, step).toBeLessThanOrEqual(0);
  }
});

test('keyboard users can reach the main controls and open the sections', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(fontFile);
  await openStep(page, 'results');
  const section = page.getByRole('button', { name: 'Browser support', exact: true });
  await section.focus();
  await expect(section).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter');
  await expect(section).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Space');
  await expect(section).toHaveAttribute('aria-expanded', 'false');
  await openStep(page, 'tuning');
  await expect(page.getByRole('button', { name: /^Remove: SourceSans/ })).toBeVisible();
});

test('forced colors keeps the support states distinguishable by text', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(fontFile);
  await openSupport(page);
  const matrix = page.getByRole('region', { name: 'Browser support' });
  await expect(matrix.getByText('Fully adjusted').first()).toBeVisible();
  await expect(matrix.locator('[data-state]').first()).toBeVisible();
});
