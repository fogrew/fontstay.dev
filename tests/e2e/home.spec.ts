import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const locale of ['en', 'ru', 'ar']) {
  test(`${locale}: renders with the right language`, async ({ page }) => {
    await page.goto(`/${locale}/`);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.getByRole('heading', { level: 1, name: 'fontstay.dev' })).toBeAttached();
  });

  test(`${locale}: sets the text direction of the language`, async ({ page }) => {
    await page.goto(`/${locale}/`);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
  });

  test(`${locale}: header links to the repository`, async ({ page }) => {
    await page.goto(`/${locale}/`);
    await expect(page.getByRole('banner').getByRole('link', { name: /GitHub/ })).toHaveAttribute(
      'href',
      'https://github.com/fogrew/fontstay.dev',
    );
  });

  test(`${locale}: has no detectable accessibility violations`, async ({ page }) => {
    await page.goto(`/${locale}/`);
    const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
    expect(results.violations).toEqual([]);
  });
}

test('root redirects to the locale matching the browser language', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'ru-RU' });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page).toHaveURL(/\/ru\/$/);
  await context.close();
});

test('root redirect keeps the URL hash', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'ru-RU' });
  const page = await context.newPage();
  await page.goto('/#section');
  await expect(page).toHaveURL(/\/ru\/#section$/);
  await context.close();
});

test('root falls back to the default locale', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'de-DE' });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page).toHaveURL(/\/en\/$/);
  await context.close();
});

test('language switcher keeps the page and the URL hash', async ({ page }) => {
  await page.goto('/en/#section');
  const nav = page.getByRole('navigation', { name: 'Language' });
  await expect(nav.getByRole('link', { name: 'English' })).toHaveAttribute('aria-current', 'true');
  await nav.getByRole('link', { name: 'Русский' }).click();
  await expect(page).toHaveURL(/\/ru\/#section$/);
  await expect(page.getByRole('navigation', { name: 'Язык' })).toBeVisible();
});
