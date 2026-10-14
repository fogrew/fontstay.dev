import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { buildCollection, buildFont } from '../../src/modules/font-metrics/lib/forged.test-util';
import {
  choose,
  closePanels,
  expect,
  listed,
  openExport,
  openSupport,
  selectSystem,
  test,
} from './fixtures';

const fonts = new URL('../fixtures/fonts/', import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  '$1',
);
const sourceSans = `${fonts}SourceSansPro-Regular.woff2`;

test('uploading a font produces per-system fallbacks, editable values and CSS', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);

  const fallback = page.getByLabel('Fallback font 1', { exact: true });
  await expect(fallback).toBeVisible();
  const code = page.getByRole('region', { name: 'Generated CSS' });
  await expect(code).toContainText('@font-face');
  await expect(code).toContainText('size-adjust');
  await expect(code).toContainText('"Source Sans Pro Fallback');
  await expect(code).not.toContainText('font-family: font-family');

  await selectSystem(page, 'windows');
  const before = await code.textContent();
  await choose(fallback, { index: 2 });
  await expect(code).not.toHaveText(before ?? '');
  const picked = (await fallback.getAttribute('data-value')) ?? '';

  const size = page.getByRole('spinbutton', { name: /Size adjust/ });
  await size.fill('110');
  await size.press('Enter');
  await expect(code).toContainText('size-adjust: 110%');
  await expect(page.getByRole('checkbox', { name: 'Auto' }).first()).not.toBeChecked();

  await choose(fallback, { index: 0 });
  await expect(code).not.toContainText('size-adjust: 110%');
  await choose(fallback, picked);
  await expect(code).toContainText('size-adjust: 110%');
});

test('serif and monospace fallbacks are available by font type', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await selectSystem(page, 'windows');
  await choose(page.getByLabel('Font type'), 'serif');
  expect(await listed(page.getByLabel('Fallback font 1', { exact: true }))).toContain(
    'Times New Roman',
  );
  await expect(page.getByRole('region', { name: 'Generated CSS' })).toContainText('serif;');
});

test('the fallback list follows the selected system and reports shadowing with a fix', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  const fallback = page.getByLabel('Fallback font 1', { exact: true });

  await selectSystem(page, 'android');
  expect(await listed(fallback)).toContain('Roboto');
  expect(await listed(fallback)).not.toContain('Segoe UI');
  await selectSystem(page, 'windows');
  expect(await listed(fallback)).toContain('Segoe UI');
  expect(await listed(fallback)).not.toContain('Roboto');

  await page.getByLabel('Browserslist query').fill('safari 17, chrome 120');
  await selectSystem(page, 'macos');
  await choose(fallback, 'helvetica');
  await selectSystem(page, 'windows');
  await choose(fallback, 'arial');
  await expect(page.getByText('The fallback order was changed automatically')).toBeVisible();
  await expect(page.locator('p.ff-error', { hasText: /would be used instead of/ })).toHaveCount(0);
});

test('the fit follows the page language for a font with Cyrillic', async ({ page }) => {
  await page.goto('/ru/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await selectSystem(page, 'macos');
  const fallback = page.getByLabel('Запасной шрифт 1', { exact: true });
  await expect(fallback).toBeVisible();
  await expect(fallback).not.toContainText('Только латиница');
});

test('an invalid file is rejected with an announced error', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles({
    name: 'broken.woff2',
    mimeType: 'font/woff2',
    buffer: Buffer.from('not a font at all, just text'),
  });
  await expect(page.getByRole('alert')).toContainText('broken.woff2');
});

for (const locale of ['en', 'ru']) {
  test(`${locale}: generator page has no detectable accessibility violations with a font loaded`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/`);
    await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
    await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
    await expect(page.getByRole('heading', { level: 2 }).nth(3)).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

for (const { width, height } of [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
]) {
  test(`${width}x${height}: the panels are docked at the top and the article spans the width`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/en/');
    await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
    await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
    const article = page.locator('.ff-article:not([data-probe])').first();
    await expect(article).toBeVisible();
    const dock = await page.locator('.ff-dock').boundingBox();
    const body = await article.boundingBox();
    expect(dock?.y).toBeLessThan(150);
    expect(body?.width).toBeGreaterThan(width * 0.85);
    for (const name of ['1. Inputs', '2. Fine-tuning', '3. Results']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    }
  });
}

test('the article switches between overlay, side by side, web font and fallback views', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await closePanels(page);
  const view = page.getByRole('region', { name: 'Article' });
  const mode = (name: string) => view.getByRole('button', { name, exact: true });
  await expect(mode('Overlay')).toHaveAttribute('aria-pressed', 'true');
  await expect(view.locator('.ff-article-view__overlay > .ff-article')).toHaveCount(2);
  await expect(view.locator('.ff-article--ghost')).toHaveAttribute('aria-hidden', 'true');

  await mode('Side by side').click();
  await expect(mode('Side by side')).toHaveAttribute('aria-pressed', 'true');
  await expect(view.locator('.ff-article-view__side > figure')).toHaveCount(2);

  await mode('Web font').click();
  await expect(view.locator('.ff-article:not([data-probe])')).toHaveCount(1);
  await expect(view.locator('.ff-article:not([data-probe])')).toHaveCSS(
    'font-family',
    /ff-web-source-sans-pro/,
  );
  await mode('Adjusted fallback').click();
  await expect(view.locator('.ff-article:not([data-probe])')).toHaveCSS('font-family', /Fallback/);
  await mode('Plain fallback').click();
  await expect(view.locator('.ff-article:not([data-probe])')).toHaveCSS(
    'font-family',
    /sans-serif/,
  );

  await view.getByLabel(/Text size/).fill('24');
  await expect(view.locator('.ff-article:not([data-probe])')).toHaveCSS('font-size', '24px');
  await view.getByLabel(/Line height/).fill('2');
  await expect(view.locator('.ff-article:not([data-probe])')).toHaveCSS('line-height', '48px');
});

test('the layer tools draw, fade and compare the web font and the fallback', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await closePanels(page);
  const view = page.getByRole('region', { name: 'Article' });
  const layer = (name: string) => view.getByRole('group', { name, exact: true });
  const ghost = view.locator('.ff-article--ghost');
  await expect(ghost).toHaveAttribute('data-render', 'outline');

  await choose(layer('Adjusted fallback').getByLabel('Drawing'), 'fill');
  await expect(ghost).toHaveAttribute('data-render', 'fill');
  await choose(layer('Adjusted fallback').getByLabel('Drawing'), 'outline');
  await layer('Adjusted fallback').getByLabel('Opacity').fill('40');
  await expect(ghost).toHaveCSS('opacity', '0.4');
  await layer('Adjusted fallback').getByLabel('Outline width').fill('3');
  await expect(ghost).toHaveCSS('--ff-layer-stroke', '3px');
  await choose(layer('Adjusted fallback').getByLabel('Colour'), 'red');
  await expect(ghost).toHaveCSS('-webkit-text-stroke-color', /^rgb/);

  await view.getByRole('checkbox', { name: 'Glyph boxes' }).check();
  await expect(view.locator('.ff-article:not([data-probe]) canvas.ff-article__boxes')).toHaveCount(
    2,
  );

  await view.getByRole('button', { name: 'Side by side', exact: true }).click();
  const side = view.locator('.ff-article-view__side');
  const rows = () =>
    side.evaluate(
      (node) => new Set([...node.children].map((child) => child.getBoundingClientRect().top)).size,
    );
  await expect.poll(rows).toBe(1);
  await choose(view.getByLabel('Arrangement'), 'stacked');
  await expect.poll(rows).toBe(2);
  await view.getByRole('checkbox', { name: 'Guide lines' }).check();
  await expect(view.getByRole('list', { name: 'Guide lines' }).getByRole('listitem')).toHaveCount(
    5,
  );
  const body = view.locator('.ff-article:not([data-probe])').first();
  await expect
    .poll(() => body.evaluate((node) => node.style.getPropertyValue('--ff-guides')))
    .toContain('linear-gradient');
});

test('the text wrapping and sample text controls change the article', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await closePanels(page);
  const view = page.getByRole('region', { name: 'Article' });
  const article = view.locator('.ff-article:not([data-probe])').first();
  await choose(view.getByLabel('Text wrapping'), 'balance');
  await expect(article).toHaveCSS('text-wrap-mode', 'wrap');
  await expect(article).toHaveCSS('text-wrap-style', 'balance');
  await choose(view.getByLabel('Sample text'), 'ar');
  await expect(article).toHaveAttribute('dir', 'rtl');
  await expect(article).toHaveAttribute('lang', 'ar');
  await choose(view.getByLabel('Sample text'), 'ja');
  await expect(article).toHaveAttribute('lang', 'ja');
  await expect(view.getByRole('heading', { name: /フォントの読み込み/ })).toBeVisible();
});

test('the CSS stays reachable while the article is large', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  const code = page.getByRole('region', { name: 'Generated CSS' });
  await expect(code).toBeInViewport();
  const box = await code.boundingBox();
  expect(box?.height).toBeGreaterThan(40);
});

test('a font with few Latin glyphs warns about coverage and previews its own glyphs', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  const font = buildFont(
    [
      [0x61, 0x61, 1],
      [0x65, 0x65, 2],
      [0x74, 0x74, 3],
      [0x16a0, 0x16b3, 4],
    ],
    30,
  );
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles({
    name: 'runes.ttf',
    mimeType: 'font/ttf',
    buffer: Buffer.from(font),
  });
  await expect(page.getByRole('status').filter({ hasText: 'Covered share' })).toBeVisible();
  await closePanels(page);
  await expect(page.locator('.ff-article__missing').first()).toBeVisible();
});

test('the audience editor resolves presets and reports invalid queries', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  const list = page.getByRole('list', { name: 'Resolved browsers' });
  await expect(list).toContainText('Chrome');
  await expect(page.getByText(/\d+ browser versions/)).toBeVisible();
  await expect(page.getByText(/Browser data up to/)).toBeVisible();

  const query = page.getByLabel('Browserslist query');
  await query.fill('chrome 120');
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByLabel('Preset')).toHaveAttribute('data-value', 'custom');

  await query.fill('not a query');
  await expect(page.getByRole('status').filter({ hasText: 'not valid' })).toBeVisible();
  await expect(query).toHaveAttribute('aria-invalid', 'true');

  await choose(page.getByLabel('Preset'), 'defaults');
  await expect(query).toHaveValue('defaults');
  await expect(list).toBeVisible();
});

test('the audience editor passes axe when open', async ({ page }) => {
  await page.goto('/ru/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await expect(page.getByRole('list', { name: 'Подходящие браузеры' })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('imported usage statistics enable "in my stats" queries and report ignored entries', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  const upload = (content: string) =>
    page.locator('input[type="file"][accept*="json"]').setInputFiles({
      name: 'browserslist-stats.json',
      mimeType: 'application/json',
      buffer: Buffer.from(content),
    });

  await upload('not json');
  await expect(page.getByText('not valid JSON')).toBeVisible();

  await upload(
    JSON.stringify({
      chrome: { '120': 60, '119': 3, '1': 1 },
      firefox: { '121': 10 },
      nope: { '1': 1 },
    }),
  );
  await expect(page.getByText(/3 statistics entries loaded/)).toBeVisible();
  await expect(page.getByText(/Ignored unknown browsers: nope/)).toBeVisible();
  await expect(page.getByText(/Ignored 1 unknown versions, for example: chrome 1/)).toBeVisible();
  await expect(page.getByLabel('Browserslist query')).toHaveValue('> 0.5% in my stats');
  await expect(page.getByText('Covers 73.0% of your traffic')).toBeVisible();
  await expect(page.getByLabel('Preset')).toHaveAttribute('data-value', 'mystats');

  await page.getByRole('button', { name: 'Remove my statistics' }).click();
  await expect(page.getByRole('button', { name: 'Import browserslist-stats.json' })).toBeFocused();
  await expect(page.getByLabel('Browserslist query')).toHaveValue('baseline widely available');
  await expect(page.getByRole('link', { name: 'browserslist-ga', exact: true })).toBeVisible();
});

test('system shares follow the query and the tag controls edit it', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.getByLabel('Browserslist query').fill('safari 17, ios_saf 17.0-17.1');
  const shares = page.getByRole('list', { name: 'Estimated audience by system' });
  await expect(shares).toContainText('macOS');
  await expect(shares).toContainText('iOS and iPadOS');
  await expect(shares).not.toContainText('Windows');

  await page.getByLabel('Browserslist query').fill('firefox 120');
  await expect(shares).toContainText('Windows');

  await page.getByRole('radio', { name: 'Excluded' }).check();
  await page.getByRole('button', { name: 'firefox', exact: true }).click();
  await expect(page.getByLabel('Browserslist query')).toHaveValue('firefox 120, not firefox > 0');
  await page.getByRole('button', { name: 'Remove: not firefox > 0' }).click();
  await expect(page.getByLabel('Browserslist query')).toHaveValue('firefox 120');
  await page.getByRole('radio', { name: 'Included' }).check();
  await page.getByRole('button', { name: '> 1%', exact: true }).click();
  await expect(page.getByLabel('Browserslist query')).toHaveValue('firefox 120, > 1%');
});

test('a system can have several ordered fallbacks', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await openSupport(page);
  await selectSystem(page, 'windows');
  const code = page.getByRole('region', { name: 'Generated CSS' });
  await choose(page.getByLabel('Fallback font 1', { exact: true }), 'segoe-ui');
  await expect(page.getByLabel('Fallback font 2', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Add fallback' }).click();
  const second = page.getByLabel('Fallback font 2', { exact: true });
  await expect(second).toBeVisible();
  await choose(second, 'arial');
  await expect(code).toContainText('"Source Sans Pro Fallback Segoe UI"');
  await expect(code).toContainText('"Source Sans Pro Fallback Arial"');
  await expect(
    page.getByRole('region', { name: 'Browser support' }).getByText('Segoe UI, Arial'),
  ).toBeVisible();
  await expect(
    page.getByLabel('Fallback font 1', { exact: true }).locator('option[value="arial"]'),
  ).toHaveCount(0);

  await choose(page.getByLabel('Adjust values of'), 'arial');
  const size = page.getByRole('spinbutton', { name: /Size adjust/ });
  await size.fill('120');
  await size.press('Enter');
  await expect(code).toContainText('size-adjust: 120%');

  await page.getByRole('button', { name: 'Remove: Fallback font 2' }).click();
  await expect(second).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Browser support' }).getByText(/^Segoe UI$/),
  ).toBeVisible();
});

test('the support matrix shows the audience by system with ranges, states and shifts', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await openSupport(page);
  const code = page.getByRole('region', { name: 'Generated CSS' });
  await expect(code).toContainText('font-size-adjust');
  await expect(code).toContainText('line-height: 1.4');

  const matrix = page.getByRole('region', { name: 'Browser support' });
  await expect(matrix.getByRole('heading', { level: 3 }).first()).toBeVisible();
  await expect(matrix).toContainText('Safari');
  await expect(matrix).toContainText('Partly adjusted');
  await expect(matrix).toContainText(/\d+–\d+/);
  await expect(matrix.getByText(/CLS \d/).first()).toBeVisible();

  await page.getByLabel('Browserslist query').fill('chrome 120');
  await expect(matrix.getByRole('heading', { level: 4, name: /^Chrome/ }).first()).toBeVisible();
  await expect(matrix.getByRole('heading', { level: 4, name: /^Safari/ })).toHaveCount(0);
  await expect(code).not.toContainText('font-size-adjust');
});

test('a system can be switched off and then falls back to the generic family', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await openSupport(page);
  const matrix = page.getByRole('region', { name: 'Browser support' });
  await expect(matrix).not.toContainText('Generic fallback');
  await page.getByRole('checkbox', { name: 'Include Android in the stack' }).uncheck();
  await expect(matrix).toContainText('Generic fallback');
  await expect(matrix.locator('[data-state="none"]').first()).toBeVisible();
  await page.getByRole('checkbox', { name: 'Include Android in the stack' }).check();
  await expect(matrix).not.toContainText('Generic fallback');
});

test('the support matrix shows the shift with and without the CSS and the result can be verified', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await openSupport(page);
  const matrix = page.getByRole('region', { name: 'Browser support' });
  await expect(matrix.locator('[data-rating]').first()).toBeVisible();
  await expect(matrix.getByText(/was \d/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Layout shift', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Verify on this device' }).click();
  await expect(page.getByText(/Measured in the browser/)).toBeVisible({ timeout: 25_000 });
});

test('spacing adds the fonts-loading CSS and script', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  const code = page.getByRole('region', { name: 'Generated CSS' });
  await expect(code).not.toContainText('fonts-loading');
  await page.getByText('Spacing while fonts load').click();
  await page.getByRole('checkbox', { name: 'Compensate spacing while the font loads' }).check();
  const letter = page.getByRole('spinbutton', { name: /Letter spacing/ });
  await letter.fill('0.2');
  await letter.press('Enter');
  await expect(code).toContainText('.fonts-loading');
  await expect(code).toContainText('letter-spacing: 0.002em');
  await choose(page.getByLabel('Format'), { label: 'Font Loading API script' });
  const script = page.getByRole('region', { name: 'font-loading.js' });
  await expect(script).toContainText("classList.add('fonts-loading')");
  await expect(script).toContainText(`'1em "Source Sans Pro"'`);
});

test('values are optimized automatically and pinned values stay', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await selectSystem(page, 'windows');
  await choose(page.getByLabel('Fallback font 1', { exact: true }), 'arial');
  await expect(page.getByRole('button', { name: 'Optimize for CLS' })).toHaveCount(0);
  const code = page.getByRole('region', { name: 'Generated CSS' });
  const size = page.getByRole('spinbutton', { name: /Size adjust/ });
  await size.fill('108');
  await size.press('Enter');
  await expect(code).toContainText('size-adjust: 108%');
  await page.waitForTimeout(1500);
  await expect(code).toContainText('size-adjust: 108%');
  await expect(page.getByRole('checkbox', { name: 'Auto' }).nth(1)).toBeChecked();
});

test('the columns and the support section can be collapsed and the layout is remembered', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  const inputs = page.getByRole('button', { name: '1. Inputs' });
  await expect(inputs).toHaveAttribute('aria-expanded', 'true');
  await inputs.click();
  await expect(inputs).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#ff-settings')).toBeHidden();
  await page.reload();
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await expect(page.getByRole('button', { name: '1. Inputs' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await page.getByRole('button', { name: '1. Inputs' }).click();
  await expect(page.locator('#ff-settings')).toBeVisible();
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);

  const support = page.getByRole('button', { name: 'Browser support', exact: true });
  await expect(support).toHaveAttribute('aria-expanded', 'false');
  await support.click();
  await expect(page.getByRole('region', { name: 'Browser support' })).toBeVisible();
  await support.click();
  await expect(page.getByRole('region', { name: 'Browser support' })).toBeHidden();
});

test('the dock stays pinned to the top while the article scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 1453, height: 800 });
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await closePanels(page);
  await expect(page.locator('.ff-article:not([data-probe])').first()).toBeVisible();
  await page.mouse.wheel(0, 900);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
  const dock = await page.locator('.ff-dock').boundingBox();
  expect(dock?.y).toBeLessThan(2);
  await expect(page.getByRole('button', { name: '3. Results', exact: true })).toBeInViewport();
});

test('a system with a single known font explains why no fallback can be added', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await selectSystem(page, 'android');
  await expect(page.getByRole('button', { name: 'Add fallback' })).toBeDisabled();
  await expect(page.getByText(/no other fonts of this type are known yet/)).toBeVisible();
});

test('the unicode-range toggle limits the fallbacks to the covered characters', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  const code = page.getByRole('region', { name: 'Generated CSS' });
  await expect(code).toContainText('size-adjust');
  await expect(code).not.toContainText('unicode-range');
  await page.getByRole('checkbox', { name: /Limit the fallbacks to the characters/ }).check();
  await expect(code).toContainText('unicode-range: U+');
  await page.getByRole('checkbox', { name: /Limit the fallbacks to the characters/ }).uncheck();
  await expect(code).not.toContainText('unicode-range');
});

test('the coverage section shows a Unicode map and a per-block table', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await page.getByRole('button', { name: 'Glyph coverage', exact: true }).click();
  await expect(page.getByText(/code points in \d+ Unicode blocks/)).toBeVisible();
  const table = page.getByRole('table', { name: 'Glyph coverage per Unicode block' });
  await expect(table.getByRole('row', { name: /Basic Latin/ })).toBeVisible();
  const map = page.getByRole('group', { name: 'Unicode map of Basic Latin' });
  const status = page.locator('.ff-map__readout');
  await map.locator('[data-cp="65"]').hover();
  await expect(status).toContainText('U+0041 · A');
  await expect(status).toContainText('covered');
  await map.focus();
  await page.keyboard.press('ArrowRight');
  await expect(status).toContainText('U+0042 · B');
  await page.keyboard.press('ArrowUp');
  await expect(status).toContainText('U+0032');
});

test('the style select switches a system to the bold face and adds the descriptors', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await selectSystem(page, 'windows');
  const code = page.getByRole('region', { name: 'Generated CSS' });
  await expect(code).not.toContainText('font-weight');
  await choose(page.getByLabel('Font style'), 'bold');
  await expect(code).toContainText('font-weight: 700;');
  await expect(code).toContainText('Bold');
  await choose(page.getByLabel('Font style'), 'italic');
  await expect(code).toContainText('font-style: italic;');
  await expect(code).not.toContainText('font-weight');
});

test('a font collection is split into separate fonts', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  const collection = buildCollection([buildFont([[0x41, 0x5a, 1]]), buildFont([[0x61, 0x7a, 1]])]);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles({
    name: 'pair.ttc',
    mimeType: 'font/collection',
    buffer: Buffer.from(collection),
  });
  await expect(page.getByRole('button', { name: 'Remove: pair.ttc #1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove: pair.ttc #2' })).toBeVisible();
});

test('characters missing from the font are highlighted and explained on focus', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await closePanels(page);
  const view = page.getByRole('region', { name: 'Article' });
  await choose(view.getByLabel('Sample text'), 'ja');
  const mark = view.locator('.ff-article:not(.ff-article--ghost) .ff-article__missing').first();
  await expect(mark).toBeVisible();
  await expect(mark).toHaveAttribute(
    'aria-description',
    /is not supported by the font.*Sans-serif/,
  );
  const overflow = () =>
    page.evaluate(() => ({
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      article: Math.max(
        ...[...document.querySelectorAll('.ff-article:not([data-probe])')].map(
          (node) => node.scrollWidth - node.clientWidth,
        ),
      ),
    }));
  const before = await overflow();
  await mark.focus();
  await expect(mark).toBeFocused();
  expect(await overflow()).toEqual(before);
  await choose(view.getByLabel('Font for the missing characters'), 'serif');
  await expect(mark).toHaveAttribute('aria-description', /Serif/);
});

test('the article shows the layout shift measured on this device and ellipsizes without wrapping', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await closePanels(page);
  const view = page.getByRole('region', { name: 'Article' });
  await expect(view.getByText(/Layout shift on this device:/)).toBeVisible();
  await expect(view.getByRole('status').filter({ hasText: /\d\.\d{3} ·/ })).toBeVisible({
    timeout: 20_000,
  });
  await choose(view.getByLabel('Text wrapping'), 'nowrap');
  await expect(view.locator('.ff-article__lead').first()).toHaveCSS('text-overflow', 'ellipsis');
  await expect(view.locator('.ff-article__lead').first()).toHaveCSS('overflow', 'hidden');
});

test('a font embedded in pasted CSS can be added and other sources are only linked', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  const encoded = readFileSync(sourceSans).toString('base64');
  const css = `@font-face { font-family: "Embedded"; font-weight: 700; src: url(data:font/woff2;base64,${encoded}) format("woff2"); }
@font-face { font-family: "Remote"; src: url(https://example.com/remote.woff2) format("woff2"); }
@font-face { font-family: "Script"; src: url(javascript:alert(1)); }`;
  await page.getByText('Import from CSS').click();
  await page.getByLabel('CSS or link').fill(css);
  await page.getByRole('button', { name: 'Read CSS' }).click();
  const list = page.getByRole('list', { name: 'Fonts found in the CSS' });
  await expect(list.getByRole('link', { name: 'Download the file' })).toHaveAttribute(
    'href',
    'https://example.com/remote.woff2',
  );
  await expect(list.getByText('Source not supported')).toBeVisible();
  await list.getByRole('button', { name: 'Add to the fonts' }).click();
  await expect(page.getByRole('button', { name: /^Remove: Embedded/ })).toBeVisible();
});

test('CSS files can be chosen and their font declarations are found automatically', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.getByText('Import from CSS').click();
  await page.getByLabel('CSS files').setInputFiles({
    name: 'fonts.css',
    mimeType: 'text/css',
    buffer: Buffer.from(
      '@font-face { font-family: "Remote"; src: url(https://example.com/remote.woff2) format("woff2"); }',
    ),
  });
  const list = page.getByRole('list', { name: 'Fonts found in the CSS' });
  await expect(list.getByRole('link', { name: 'Download the file' })).toHaveAttribute(
    'href',
    'https://example.com/remote.woff2',
  );
});

const picker = (page: Page, name: string) =>
  page.locator('details').filter({ has: page.getByText(name, { exact: true }) });

test('a Google Fonts family can be searched and downloaded through the two allowed origins', async ({
  page,
}) => {
  const cors = { 'access-control-allow-origin': '*' };
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({
      status: 200,
      headers: { ...cors, 'content-type': 'text/css' },
      body: '/* latin */\n@font-face { font-family: "Open Sans"; src: url(https://fonts.gstatic.com/s/opensans/latin.woff2) format("woff2"); }',
    }),
  );
  await page.route('https://fonts.gstatic.com/**', (route) =>
    route.fulfill({
      status: 200,
      headers: { ...cors, 'content-type': 'font/woff2' },
      body: readFileSync(sourceSans),
    }),
  );
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  const google = picker(page, 'Google Fonts');
  await google.getByText('Google Fonts', { exact: true }).click();
  await google.getByLabel('Search families').fill('open sans');
  await expect(google.getByText(/\d+ families shown/)).toBeVisible();
  await google
    .getByRole('list', { name: 'Google Fonts families' })
    .getByRole('button', { name: /^Open Sans/ })
    .click();
  await expect(google.getByLabel('Script subset')).toHaveAttribute('data-value', 'latin');
  await google.getByRole('button', { name: 'Add to the fonts' }).click();
  await expect(page.getByText('Downloaded Open Sans.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Remove: Open-Sans-400-latin/ })).toBeVisible();
});

test('a Fontsource family is downloaded from jsDelivr', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/fontsource/fonts/**', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'font/woff2' },
      body: readFileSync(sourceSans),
    }),
  );
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  const fontsource = picker(page, 'Fontsource: other open fonts');
  await fontsource.getByText('Fontsource: other open fonts', { exact: true }).click();
  await fontsource.getByLabel('Search families').fill('aileron');
  await fontsource
    .getByRole('list', { name: 'Fontsource families' })
    .getByRole('button', { name: /^Aileron/ })
    .click();
  await fontsource.getByRole('button', { name: 'Add to the fonts' }).click();
  await expect(page.getByText('Downloaded Aileron.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Remove: Aileron-400-latin/ })).toBeVisible();
});

test('a failed Google Fonts download is explained', async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  const google = picker(page, 'Google Fonts');
  await google.getByText('Google Fonts', { exact: true }).click();
  await google.getByLabel('Search families').fill('lora');
  await google
    .getByRole('list', { name: 'Google Fonts families' })
    .getByRole('button', { name: /^Lora/ })
    .click();
  await google.getByRole('button', { name: 'Add to the fonts' }).click();
  await expect(page.getByText(/Could not download the font/)).toBeVisible();
});

test('every export format can be shown, copied and downloaded', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await openExport(page);
  const format = page.getByLabel('Format');
  const expected: [string, string, RegExp][] = [
    ['CSS custom properties', 'fallback-fonts.css', /--font-body:/],
    ['Tailwind CSS v4 (@theme)', 'app.css', /@theme \{\s+--font-sans:/],
    ['Next.js (next/font/local)', 'font.ts', /localFont\(/],
    ['Nuxt Fonts', 'nuxt.config.ts', /@nuxt\/fonts/],
    ['Astro fonts config', 'astro.config.mjs', /provider: 'local'/],
    ['Preload tag', 'preload.html', /rel="preload"/],
    ['Font Loading API script', 'font-loading.js', /document\.fonts\.load/],
  ];
  for (const [label, fileName, pattern] of expected) {
    await choose(format, { label });
    await expect(page.getByRole('region', { name: fileName })).toContainText(pattern);
  }
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Download: font-loading.js/ }).click();
  expect((await download).suggestedFilename()).toBe('font-loading.js');
});

test('the impact report is built from the same state as the matrix and can be downloaded', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await openExport(page);
  await choose(page.getByLabel('Format'), { label: 'Impact report (Markdown)' });
  const report = page.getByRole('region', { name: 'impact-report.md' });
  await expect(report).toContainText('# Impact report: Source Sans Pro');
  await expect(report).toContainText('## Layout shift');
  await expect(report).toContainText('| Android |');
  await expect(report).toContainText('`size-adjust`');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Download: impact-report.md/ }).click();
  expect((await download).suggestedFilename()).toBe('impact-report.md');
});

test('fonts and settings survive a reload and the share link restores the settings', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await expect(page.getByRole('button', { name: /^Remove: SourceSansPro-Regular/ })).toBeVisible();
  const android = page.getByRole('checkbox', { name: 'Include Android in the stack' });
  await android.uncheck();
  await openExport(page);
  await page.waitForTimeout(800);

  await page.reload();
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await expect(page.getByRole('button', { name: /^Remove: SourceSansPro-Regular/ })).toBeVisible();
  await expect(
    page.getByRole('checkbox', { name: 'Include Android in the stack' }),
  ).not.toBeChecked();

  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(page.getByText('The link was copied.')).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/#s=[A-Za-z0-9_-]+$/);

  const fresh = await context.browser()?.newContext();
  if (!fresh) throw new Error('no browser');
  const other = await fresh.newPage();
  await other.goto(link);
  await other.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await other.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await other.getByRole('button', { name: '2. Fine-tuning', exact: true }).click();
  await expect(
    other.getByRole('checkbox', { name: 'Include Android in the stack' }),
  ).not.toBeChecked();
  await fresh.close();

  await page.getByRole('button', { name: 'Forget', exact: true }).click();
  await expect(page.getByText(/were removed from this browser/)).toBeVisible();
  await page.reload();
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await expect(page.getByRole('button', { name: /^Remove: .*\.(woff2|ttf)/ })).toHaveCount(0);
});

test('a corrupt share link is ignored', async ({ page }) => {
  await page.goto('/en/#s=!!!not-a-state');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await expect(page.getByRole('region', { name: 'Fonts to adapt' })).toHaveCount(0);
  await expect(page.getByText('Your web font')).toBeVisible();
});

test('the dropdown works from the keyboard, with typeahead, and has no axe violations while open', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await openExport(page);
  const format = page.getByRole('combobox', { name: 'Format' });
  await format.focus();
  await page.keyboard.press('ArrowDown');
  await expect(format).toHaveAttribute('aria-expanded', 'true');
  const results = await new AxeBuilder({ page }).include('[role="listbox"]').analyze();
  expect(results.violations).toEqual([]);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(format).toHaveAttribute('data-value', 'variables');
  await expect(format).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.type('nuxt');
  await page.keyboard.press('Enter');
  await expect(format).toHaveAttribute('data-value', 'nuxt');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(format).toHaveAttribute('aria-expanded', 'false');
  await expect(format).toHaveAttribute('data-value', 'nuxt');
});

test('a dock separator resizes the panels with the keyboard and the pointer', async ({ page }) => {
  await page.setViewportSize({ width: 1453, height: 1000 });
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  const widthOf = (name: string) =>
    page
      .getByRole('button', { name })
      .evaluate((button) => button.closest('section')?.getBoundingClientRect().width ?? 0);
  const separator = page.locator('.ff-dock__separator').first();
  const before = await widthOf('1. Inputs');
  await separator.focus();
  await page.keyboard.press('ArrowRight');
  expect(await widthOf('1. Inputs')).toBeGreaterThan(before);

  const box = await separator.boundingBox();
  if (!box) throw new Error('no separator');
  const wide = await widthOf('1. Inputs');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 60, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  expect(await widthOf('1. Inputs')).toBeLessThan(wide);
});

test('several fonts share the article and the export and are tuned one by one', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page
    .locator('input[type="file"][accept*="woff2"]')
    .setInputFiles([sourceSans, `${fonts}FiraSans-Regular.ttf`]);
  const code = page.getByRole('region', { name: 'Generated CSS' });
  await expect(code).toContainText('Source Sans Pro Fallback');
  await expect(code).toContainText('Fira Sans Fallback');
  await expect(code).toContainText('.source-sans-pro {');
  await expect(page.getByLabel('Fallback font 1', { exact: true })).toHaveCount(0);
  await choose(page.getByLabel('Format'), { label: 'Next.js (next/font/local)' });
  const next = page.getByRole('region', { name: 'font.ts' });
  await expect(next).toContainText('export const sourceSansPro = localFont');
  await expect(next).toContainText('export const firaSans = localFont');
  await expect(next).toContainText('SourceSansPro-Regular.woff2');
  await expect(next).toContainText('FiraSans-Regular.ttf');
  await choose(page.getByLabel('Format'), 'css');

  const fira = page.getByRole('button', { name: /^Fira Sans/ }).first();
  await fira.click();
  await expect(fira).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByLabel('Fallback font 1', { exact: true })).toBeVisible();
  await expect(code).not.toContainText('Source Sans Pro Fallback');
  await closePanels(page);
  const view = page.getByRole('region', { name: 'Article' });
  await expect(view.getByLabel('Headings font')).toBeVisible();
  await expect(view.getByLabel('Text font')).toBeVisible();
  await expect(view.locator('.ff-article:not([data-probe])').first()).toBeVisible();
});

test('each font keeps its own style across a reload', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page
    .locator('input[type="file"][accept*="woff2"]')
    .setInputFiles([sourceSans, `${fonts}FiraSans-Regular.ttf`]);
  const code = page.getByRole('region', { name: 'Generated CSS' });
  const open = async (name: RegExp) => {
    const header = page.getByRole('button', { name }).first();
    await header.click();
    await expect(header).toHaveAttribute('aria-expanded', 'true');
  };
  await open(/^Source Sans/);
  await choose(page.getByLabel('Font style').nth(0), 'bold');
  await open(/^Fira Sans/);
  await choose(page.getByLabel('Font style').nth(1), 'italic');
  await page.waitForTimeout(800);

  await page.reload();
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await open(/^Source Sans/);
  await expect(code).toContainText('font-weight: 700;');
  await open(/^Fira Sans/);
  await expect(code).toContainText('font-style: italic;');
  await expect(code).not.toContainText('font-weight: 700;');
});

test('panels animate with view transitions unless reduced motion is requested', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    const original = document.startViewTransition?.bind(document);
    (window as unknown as { transitions: number }).transitions = 0;
    if (original) {
      document.startViewTransition = ((update: () => Promise<void>) => {
        (window as unknown as { transitions: number }).transitions++;
        return original(update);
      }) as typeof document.startViewTransition;
    }
  });
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  const inputs = page.getByRole('button', { name: '1. Inputs' });
  await inputs.click();
  await expect(inputs).toHaveAttribute('aria-expanded', 'false');
  expect(
    await page.evaluate(() => (window as unknown as { transitions: number }).transitions),
  ).toBe(1);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await inputs.click();
  await expect(inputs).toHaveAttribute('aria-expanded', 'true');
  expect(
    await page.evaluate(() => (window as unknown as { transitions: number }).transitions),
  ).toBe(1);
});

test('the export code is syntax highlighted without inline styles', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  const code = page.getByRole('region', { name: 'Generated CSS' });
  await expect(code.locator('code span[class^="ff-tok-"]').first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(code.locator('code [style]')).toHaveCount(0);
  await expect(code).toContainText('@font-face');
  await choose(page.getByLabel('Format'), { label: 'Next.js (next/font/local)' });
  const next = page.getByRole('region', { name: 'font.ts' });
  await expect(next.locator('code span[class^="ff-tok-"]').first()).toBeVisible({
    timeout: 15_000,
  });
});

test('the article uses the system font stack until a font is added', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await closePanels(page);
  await expect(page.getByText(/Choose a web font or drop it anywhere/)).toBeVisible();
  await expect(page.locator('.ff-article:not([data-probe])')).toHaveCSS('font-family', /system-ui/);
});

test('fonts and CSS files can be dropped anywhere on the page', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await closePanels(page);
  const bytes = [...readFileSync(sourceSans)];
  const drop = (name: string, type: string, content: number[] | string) =>
    page.evaluate(
      ([fileName, mime, data]) => {
        const transfer = new DataTransfer();
        const part = typeof data === 'string' ? data : new Uint8Array(data as number[]);
        transfer.items.add(new File([part], fileName as string, { type: mime as string }));
        for (const kind of ['dragenter', 'dragover', 'drop']) {
          window.dispatchEvent(
            new DragEvent(kind, { dataTransfer: transfer, bubbles: true, cancelable: true }),
          );
        }
      },
      [name, type, content],
    );
  await drop('SourceSansPro-Regular.woff2', 'font/woff2', bytes);
  await expect(page.locator('.ff-article-view__overlay')).toBeVisible({ timeout: 15_000 });
  await drop(
    'fonts.css',
    'text/css',
    '@font-face { font-family: "Remote"; src: url(https://example.com/remote.woff2) format("woff2"); }',
  );
  await expect(page.getByRole('button', { name: '1. Inputs', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await expect(
    page
      .getByRole('list', { name: 'Fonts found in the CSS' })
      .getByRole('link', { name: 'Download the file' }),
  ).toBeVisible();
  await drop('notes.txt', 'text/plain', 'hello');
  await expect(page.getByRole('alert')).toContainText('Only font files');
});

test('the generator page itself does not shift while it loads', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.addInitScript(() => {
    (window as unknown as { shifts: number }).shifts = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
      }[]) {
        if (!entry.hadRecentInput) (window as unknown as { shifts: number }).shifts += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.waitForTimeout(1500);
  const total = await page.evaluate(() => (window as unknown as { shifts: number }).shifts);
  expect(total).toBeLessThan(0.02);
});
