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

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(nav.getByRole('link')).toHaveCount(4);
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
