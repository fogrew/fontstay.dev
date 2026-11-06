import { expect, LOCALES, test } from './fixtures';

test.describe('mobile header menu', () => {
  test.use({ viewport: { width: 375, height: 700 } });

  test('collapses the navigation behind a toggle, closes on Escape and resets on resize', async ({
    page,
  }) => {
    await page.goto('/en/fonts/');
    const toggle = page.getByRole('button', { name: 'Menu' });
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toHaveAttribute('aria-controls', 'ff-nav');
    await expect(nav).toBeHidden();
    await expect(page.locator('[data-locale-menu] > summary')).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(nav.getByRole('link')).toHaveCount(5);
    await expect(nav.locator('a[aria-current="page"]')).toHaveText('System fonts');

    await nav.getByRole('link').first().focus();
    await page.keyboard.press('Escape');
    await expect(nav).toBeHidden();
    await expect(toggle).toBeFocused();

    await toggle.click();
    await page.setViewportSize({ width: 1024, height: 700 });
    await expect(nav).toBeVisible();
    await expect(toggle).toBeHidden();
    await page.setViewportSize({ width: 375, height: 700 });
    await expect(nav).toBeHidden();
  });

  test('keeps a single dropdown open at a time', async ({ page }) => {
    await page.goto('/en/');
    const toggle = page.getByRole('button', { name: 'Menu' });
    const language = page.locator('[data-locale-menu]');
    await toggle.click();
    await language.locator('summary').click();
    await expect(language).toHaveJSProperty('open', true);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(language).toHaveJSProperty('open', false);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  test('opening with the keyboard focuses the first link', async ({ page }) => {
    await page.goto('/en/');
    const toggle = page.getByRole('button', { name: 'Menu' });
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#ff-nav a').first()).toBeFocused();
  });

  test('closes when clicking outside the header', async ({ page }) => {
    await page.goto('/en/');
    const toggle = page.getByRole('button', { name: 'Menu' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.mouse.click(10, 600);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  for (const locale of LOCALES) {
    test(`${locale}: the open header does not overflow horizontally`, async ({ page }) => {
      await page.goto(`/${locale}/`);
      await page.locator('[data-nav-toggle]').click();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
