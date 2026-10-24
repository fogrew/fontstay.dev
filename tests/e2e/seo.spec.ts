import { expect, test } from './fixtures';

for (const locale of ['en', 'ru', 'ar']) {
  test(`${locale}: pages carry the title, description, Open Graph and structured data`, async ({
    page,
  }) => {
    for (const path of ['/', '/fonts/', '/fonts/arial/', '/presets/']) {
      await page.goto(`/${locale}${path}`);
      const title = await page.title();
      expect(title.length).toBeGreaterThan(10);
      const description = await page.locator('meta[name="description"]').getAttribute('content');
      expect((description ?? '').length).toBeGreaterThan(40);
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', title);
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        'content',
        'https://fontstay.dev/og.png',
      );
      await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute(
        'content',
        { en: 'en_US', ru: 'ru_RU', ar: 'ar_AR' }[locale] ?? '',
      );
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `https://fontstay.dev/${locale}${path}`,
      );
      await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1);
    }
    await page.goto(`/${locale}/`);
    const ld = await page.locator('script[type="application/ld+json"]').textContent();
    expect(JSON.parse(ld ?? '{}')).toMatchObject({ '@type': 'WebApplication', inLanguage: locale });
  });
}

test('titles differ per page', async ({ page }) => {
  const titles = new Set<string>();
  for (const path of ['/en/', '/en/fonts/', '/en/fonts/arial/', '/en/presets/']) {
    await page.goto(path);
    titles.add(await page.title());
  }
  expect(titles.size).toBe(4);
});

test('sitemap, robots and the share image are served', async ({ request }) => {
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBe(true);
  const xml = await sitemap.text();
  expect(xml).toContain('<loc>https://fontstay.dev/en/fonts/arial/</loc>');
  expect(xml).toContain('hreflang="ru" href="https://fontstay.dev/ru/presets/"');
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Sitemap: https://fontstay.dev/sitemap.xml');
  const image = await request.get('/og.png');
  expect(image.headers()['content-type']).toContain('image/png');
});
