import { expect, test } from './fixtures';

test('pages carry the baseline security headers', async ({ page }) => {
  const response = await page.goto('/en/');
  const headers = response?.headers() ?? {};
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['permissions-policy']).toContain('camera=()');
  expect(headers['cross-origin-opener-policy']).toBe('same-origin');
  expect(headers['content-security-policy']).toContain("frame-ancestors 'self'");
});

test('only the import page can keep its opener and it has no app code', async ({ page }) => {
  const response = await page.goto('/en/import/');
  const headers = response?.headers() ?? {};
  expect(headers['cross-origin-opener-policy']).toBeUndefined();
  expect(headers['content-security-policy']).toContain("frame-ancestors 'self'");
  const policy = await page
    .locator('meta[http-equiv="content-security-policy"]')
    .getAttribute('content');
  expect(policy).toContain("default-src 'self'");
  expect(policy).not.toContain('unsafe-inline');
  const scripts = await page
    .locator('script[src]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('src')));
  expect(scripts.length).toBeLessThanOrEqual(2);
});

test('the hashed CSP allows no unsafe sources', async ({ page }) => {
  await page.goto('/en/');
  const policy = await page
    .locator('meta[http-equiv="content-security-policy"]')
    .getAttribute('content');
  expect(policy).toContain("default-src 'self'");
  expect(policy).toMatch(/script-src[^;]*'sha256-/);
  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain("base-uri 'none'");
  expect(policy).not.toContain('unsafe-eval');
  expect(policy).not.toContain('unsafe-inline');
});

test('hashed build assets are cached immutably', async ({ page }) => {
  await page.goto('/en/');
  const src = await page.locator('script[src^="/_astro/"], link[href^="/_astro/"]').first();
  const url = (await src.getAttribute('src')) ?? (await src.getAttribute('href'));
  const headers = await page.evaluate(async (assetUrl) => {
    const response = await fetch(assetUrl);
    return {
      cacheControl: response.headers.get('cache-control'),
      nosniff: response.headers.get('x-content-type-options'),
    };
  }, url ?? '');
  expect(headers.cacheControl).toContain('immutable');
  expect(headers.nosniff).toBe('nosniff');
});

test('same-origin frames are allowed', async ({ page }) => {
  await page.goto('/en/');
  const title = await page.evaluate(
    (src) =>
      new Promise<string>((resolve, reject) => {
        const frame = document.createElement('iframe');
        frame.onload = () => resolve(frame.contentDocument?.title ?? '');
        frame.onerror = () => reject(new Error('frame failed'));
        frame.src = src;
        document.body.append(frame);
      }),
    '/ru/',
  );
  expect(title).toContain('fontstay.dev');
});

test('directory URLs redirect to the trailing-slash form', async ({ request }) => {
  const response = await request.get('/en', { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers().location).toBe('/en/');
});
