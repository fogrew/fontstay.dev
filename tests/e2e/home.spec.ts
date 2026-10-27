import AxeBuilder from '@axe-core/playwright';
import { expect, LOCALES, RTL_LOCALES, test } from './fixtures';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const locale of LOCALES) {
  test(`${locale}: renders with the right language`, async ({ page }) => {
    await page.goto(`/${locale}/`);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.getByRole('heading', { level: 1, name: 'fontstay.dev' })).toBeAttached();
  });

  test(`${locale}: sets the text direction of the language`, async ({ page }) => {
    await page.goto(`/${locale}/`);
    await expect(page.locator('html')).toHaveAttribute(
      'dir',
      RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr',
    );
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

test('a page loads the message file of its own locale only', async ({ page }) => {
  const files: string[] = [];
  page.on('request', (request) => {
    const match = /\/_astro\/(en|ru|ar|es)\.[\w-]+\.json$/.exec(request.url());
    if (match?.[1]) files.push(match[1]);
  });
  for (const locale of LOCALES) {
    files.length = 0;
    await page.goto(`/${locale}/`);
    await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
    expect(files, locale).toEqual([locale]);
  }
});

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
  await nav.locator('summary').click();
  await expect(nav.getByRole('link', { name: 'English' })).toHaveAttribute('aria-current', 'true');
  await page.keyboard.press('Escape');
  await expect(nav.getByRole('link', { name: 'Русский' })).toBeHidden();
  await expect(nav.locator('summary')).toBeFocused();
  await nav.locator('summary').click();
  await page.getByRole('heading', { level: 1, name: 'fontstay.dev' }).click({ force: true });
  await expect(nav.getByRole('link', { name: 'Русский' })).toBeHidden();
  await nav.locator('summary').click();
  await nav.getByRole('link', { name: 'Русский' }).click();
  await expect(page).toHaveURL(/\/ru\/#section$/);
  await expect(page.getByRole('navigation', { name: 'Язык' })).toBeVisible();
});
