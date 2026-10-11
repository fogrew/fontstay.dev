import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { buildCollection, buildFont } from '../../src/modules/font-metrics/lib/forged.test-util';
import { expect, selectSystem, test } from './fixtures';

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
  await fallback.selectOption({ index: 2 });
  await expect(code).not.toHaveText(before ?? '');
  const picked = await fallback.inputValue();

  const size = page.getByRole('spinbutton', { name: /Size adjust/ });
  await size.fill('110');
  await size.press('Enter');
  await expect(code).toContainText('size-adjust: 110%');
  await expect(page.getByRole('checkbox', { name: 'Auto' }).first()).not.toBeChecked();

  await fallback.selectOption({ index: 0 });
  await expect(code).not.toContainText('size-adjust: 110%');
  await fallback.selectOption(picked);
  await expect(code).toContainText('size-adjust: 110%');
});

test('serif and monospace fallbacks are available by font type', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await selectSystem(page, 'windows');
  await page.getByLabel('Font type').selectOption('serif');
  await expect(page.getByLabel('Fallback font 1', { exact: true })).toContainText(
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
  await expect(fallback).toContainText('Roboto');
  await expect(fallback).not.toContainText('Segoe UI');
  await selectSystem(page, 'windows');
  await expect(fallback).toContainText('Segoe UI');
  await expect(fallback).not.toContainText('Roboto');

  await page.getByText('Audience (browsers)').click();
  await page.getByLabel('Browserslist query').fill('safari 17, chrome 120');
  await selectSystem(page, 'macos');
  await fallback.selectOption('helvetica');
  await selectSystem(page, 'windows');
  await fallback.selectOption('arial');
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
  test(`${width}x${height}: settings and results fit the first viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/en/');
    await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
    await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
    await expect(page.getByRole('button', { name: 'Preview', exact: true })).toBeVisible();
    const sizes = await page.evaluate(() => ({
      page: [document.documentElement.scrollHeight, window.innerHeight],
      settings: document.querySelector('.ff-generator__settings')?.scrollHeight,
      settingsVisible: document.querySelector('.ff-generator__settings')?.clientHeight,
    }));
    expect(sizes.page[0]).toBeLessThanOrEqual(sizes.page[1] ?? 0);
    const settings = await page.locator('.ff-generator__settings').boundingBox();
    const results = await page.locator('.ff-generator__main').boundingBox();
    expect(settings?.x).toBeLessThan(results?.x ?? 0);
  });
}

test('preview modes switch between side by side, overlay, web font and fallback', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  const preview = page.getByRole('region', { name: 'Preview' });
  const mode = (name: string) => preview.getByRole('button', { name, exact: true });
  await expect(mode('Overlay')).toHaveAttribute('aria-pressed', 'true');
  await expect(preview.getByRole('figure')).toHaveCount(1);

  await mode('Side by side').click();
  await expect(mode('Side by side')).toHaveAttribute('aria-pressed', 'true');
  await expect(preview.getByRole('figure')).toHaveCount(2);

  await mode('Overlay').click();
  await expect(preview.getByRole('figure')).toHaveCount(1);
  await expect(preview).toContainText('outlined dotted text');
  await expect(preview.locator('[aria-hidden="true"].ff-preview__outline')).toHaveCount(1);

  await mode('Web font').click();
  await expect(preview.getByRole('figure', { name: 'Web font' })).toHaveCount(1);
  await expect(preview.getByRole('figure', { name: 'Adjusted fallback' })).toHaveCount(0);
  await mode('Adjusted fallback').click();
  await expect(preview.getByRole('figure', { name: 'Adjusted fallback' })).toHaveCount(1);

  await preview.getByLabel(/Text size/).fill('48');
  await expect(preview.locator('.ff-preview__text').first()).toHaveCSS('font-size', '48px');
});

test('preview does not animate when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await expect(page.getByRole('figure').first()).toHaveCSS('transition-duration', '0s');
});

test('the CSS tab keeps the generated code reachable', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  const preview = page.getByRole('region', { name: 'Preview' });
  await preview.getByLabel('Text size').fill('72');
  await preview.getByLabel('Line height').fill('2');
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
  const sample = page.getByRole('textbox', { name: 'Sample text' });
  await expect(sample).not.toHaveText(/quick/);
  await expect(sample).toHaveText(/[ᚠ-ᚳ]/);
});

test('the audience editor resolves presets and reports invalid queries', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.getByText('Audience (browsers)').click();
  const list = page.getByRole('list', { name: 'Resolved browsers' });
  await expect(list).toContainText('Chrome');
  await expect(page.getByText(/\d+ browser versions/)).toBeVisible();
  await expect(page.getByText(/Browser data up to/)).toBeVisible();

  const query = page.getByLabel('Browserslist query');
  await query.fill('chrome 120');
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByLabel('Preset')).toHaveValue('custom');

  await query.fill('not a query');
  await expect(page.getByRole('status').filter({ hasText: 'not valid' })).toBeVisible();
  await expect(query).toHaveAttribute('aria-invalid', 'true');

  await page.getByLabel('Preset').selectOption('defaults');
  await expect(query).toHaveValue('defaults');
  await expect(list).toBeVisible();
});

test('the audience editor passes axe when open', async ({ page }) => {
  await page.goto('/ru/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.getByText('Аудитория (браузеры)').click();
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
  await page.getByText('Audience (browsers)').click();
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
  await expect(page.getByLabel('Preset')).toHaveValue('mystats');

  await page.getByRole('button', { name: 'Remove my statistics' }).click();
  await expect(page.getByRole('button', { name: 'Import browserslist-stats.json' })).toBeFocused();
  await expect(page.getByLabel('Browserslist query')).toHaveValue('baseline widely available');
  await expect(page.getByRole('link', { name: 'browserslist-ga', exact: true })).toBeVisible();
});

test('system shares follow the query and the manual mode', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.getByText('Audience (browsers)').click();
  await page.getByLabel('Browserslist query').fill('safari 17, ios_saf 17.0-17.1');
  const shares = page.getByRole('list', { name: 'Estimated audience by system' });
  await expect(shares).toContainText('macOS');
  await expect(shares).toContainText('iOS and iPadOS');
  await expect(shares).not.toContainText('Windows');

  await page.getByLabel('Browserslist query').fill('firefox 120');
  await expect(shares).toContainText('Windows');
  await page.getByLabel('Choose systems manually').check();
  await expect(page.getByText('Enter a weight for at least one system.')).toBeVisible();
  await page.getByLabel('Android').fill('3');
  await page.getByLabel('iOS and iPadOS').fill('1');
  await expect(shares).toContainText('75');
  await expect(shares).not.toContainText('Windows');
});

test('a system can have several ordered fallbacks', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await selectSystem(page, 'windows');
  const code = page.getByRole('region', { name: 'Generated CSS' });
  await page.getByLabel('Fallback font 1', { exact: true }).selectOption('segoe-ui');
  await expect(page.getByLabel('Fallback font 2', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Add fallback' }).click();
  const second = page.getByLabel('Fallback font 2', { exact: true });
  await expect(second).toBeVisible();
  await second.selectOption('arial');
  await expect(code).toContainText('"Source Sans Pro Fallback Segoe UI"');
  await expect(code).toContainText('"Source Sans Pro Fallback Arial"');
  await expect(
    page.getByRole('region', { name: 'Browser support' }).getByText('Segoe UI, Arial'),
  ).toBeVisible();
  await expect(
    page.getByLabel('Fallback font 1', { exact: true }).locator('option[value="arial"]'),
  ).toHaveCount(0);

  await page.getByLabel('Adjust values of').selectOption('arial');
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
  const code = page.getByRole('region', { name: 'Generated CSS' });
  await expect(code).toContainText('font-size-adjust');
  await expect(code).toContainText('line-height: 1.4');

  const matrix = page.getByRole('region', { name: 'Browser support' });
  await expect(matrix.getByRole('heading', { level: 3 }).first()).toBeVisible();
  await expect(matrix).toContainText('Safari');
  await expect(matrix).toContainText('Partly adjusted');
  await expect(matrix).toContainText(/\d+–\d+/);
  await expect(matrix.getByText(/shift \d/).first()).toBeVisible();

  await page.getByText('Audience (browsers)').click();
  await page.getByLabel('Browserslist query').fill('chrome 120');
  await expect(matrix.getByRole('heading', { level: 4, name: /^Chrome/ }).first()).toBeVisible();
  await expect(matrix.getByRole('heading', { level: 4, name: /^Safari/ })).toHaveCount(0);
  await expect(code).not.toContainText('font-size-adjust');
});

test('a system can be switched off and then falls back to the generic family', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
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
  const matrix = page.getByRole('region', { name: 'Browser support' });
  await expect(matrix.locator('[data-rating]').first()).toBeVisible();
  await expect(matrix.getByText(/without the CSS/).first()).toBeVisible();
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
  const script = page.getByRole('region', { name: 'Font loading script' });
  await expect(script).toContainText("classList.add('fonts-loading')");
  await expect(script).toContainText('Source Sans Pro');
});

test('values are optimized automatically and pinned values stay', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await selectSystem(page, 'windows');
  await page.getByLabel('Fallback font 1', { exact: true }).selectOption('arial');
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

test('the settings and the support section can be hidden and shown', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  const toggle = page.getByRole('button', { name: 'Hide settings' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await toggle.click();
  await expect(page.getByRole('button', { name: 'Show settings' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(page.locator('#ff-settings')).toBeHidden();
  await page.getByRole('button', { name: 'Show settings' }).click();
  await expect(page.locator('#ff-settings')).toBeVisible();

  const support = page.getByRole('button', { name: 'Browser support', exact: true });
  await expect(support).toHaveAttribute('aria-expanded', 'true');
  await support.click();
  await expect(page.getByRole('region', { name: 'Browser support' })).toBeHidden();
  await support.click();
  await expect(page.getByRole('region', { name: 'Browser support' })).toBeVisible();
});

test('the page itself does not scroll on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1453, height: 1000 });
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await expect(page.getByRole('region', { name: 'Browser support' })).toBeVisible();
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return {
      x: root.scrollWidth - root.clientWidth,
      y: root.scrollHeight - root.clientHeight,
    };
  });
  expect(overflow).toEqual({ x: 0, y: 0 });
});

test('the preview offers sample phrases the font can render and there is no text language field', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await expect(page.getByLabel('Text language')).toHaveCount(0);
  const phrase = page.getByLabel('Sample language');
  await expect(phrase).toBeVisible();
  await phrase.fill('German: Zwölf Boxkämpfer jagen Viktor quer über den großen Sylter Deich');
  await expect(page.getByRole('textbox', { name: 'Sample text' })).toHaveText(/Zwölf Boxkämpfer/);
  const text = page.getByRole('textbox', { name: 'Sample text' });
  await text.click();
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await expect(text).toHaveText(/Deich!/);
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

test('the panel separators move space between neighbours only', async ({ page }) => {
  await page.setViewportSize({ width: 1453, height: 1000 });
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  const separators = page.getByRole('separator');
  await expect(separators).toHaveCount(2);
  const heights = async () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.ff-accordion__item[data-open="true"]')].map(
        (item) => item.getBoundingClientRect().height,
      ),
    );
  const before = await heights();
  await separators.first().focus();
  await page.keyboard.press('ArrowDown');
  const after = await heights();
  expect(after[0] ?? 0).toBeGreaterThan(before[0] ?? 0);
  expect(after[1] ?? 0).toBeLessThan(before[1] ?? 0);
  expect(Math.abs((after[2] ?? 0) - (before[2] ?? 0))).toBeLessThan(2);

  const box = await separators.nth(1).boundingBox();
  if (!box) throw new Error('no separator');
  const mid = await heights();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 40, { steps: 5 });
  await page.mouse.up();
  const dragged = await heights();
  expect(dragged[1] ?? 0).toBeLessThan(mid[1] ?? 0);
  expect(dragged[2] ?? 0).toBeGreaterThan(mid[2] ?? 0);
  expect(Math.abs((dragged[0] ?? 0) - (mid[0] ?? 0))).toBeLessThan(2);
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
  await page.getByLabel('Font style').selectOption('bold');
  await expect(code).toContainText('font-weight: 700;');
  await expect(code).toContainText('Bold');
  await page.getByLabel('Font style').selectOption('italic');
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

test('characters missing from the font are listed, marked and can use another font', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  const preview = page.getByRole('region', { name: 'Preview' });
  await expect(
    preview.getByRole('region', { name: 'Characters missing from the font' }),
  ).toHaveCount(0);
  const text = preview.getByRole('textbox', { name: 'Sample text' });
  await text.click();
  await page.keyboard.press('End');
  await page.keyboard.type('☃');
  const missing = preview.getByRole('region', { name: 'Characters missing from the font' });
  await expect(missing).toContainText('U+2603');
  await expect(missing.locator('mark')).toHaveText('☃');
  await missing.getByLabel('Font for the missing characters').selectOption('serif');
  await expect(missing).toContainText('Serif');
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
  await page.getByText('Google Fonts', { exact: true }).click();
  await page.getByLabel('Search families').fill('open sans');
  await expect(page.getByText(/\d+ families shown/)).toBeVisible();
  const list = page.getByRole('list', { name: 'Google Fonts families' });
  await list.getByRole('button', { name: /^Open Sans/ }).click();
  await expect(page.getByLabel('Script subset')).toHaveValue('latin');
  await page.getByRole('button', { name: 'Add to the fonts' }).last().click();
  await expect(page.getByText('Downloaded Open Sans.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Remove: Open-Sans-400-latin/ })).toBeVisible();
});

test('a failed Google Fonts download is explained', async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.getByText('Google Fonts', { exact: true }).click();
  await page.getByLabel('Search families').fill('lora');
  await page
    .getByRole('list', { name: 'Google Fonts families' })
    .getByRole('button', { name: /^Lora/ })
    .click();
  await page.getByRole('button', { name: 'Add to the fonts' }).last().click();
  await expect(page.getByText(/Could not download the font/)).toBeVisible();
});

test('every export format can be shown, copied and downloaded', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const format = page.getByLabel('Format');
  const expected: Record<string, RegExp> = {
    'CSS custom properties': /--font-body:/,
    'Tailwind CSS v4 (@theme)': /@theme \{\s+--font-sans:/,
    'Next.js (next/font/local)': /localFont\(/,
    'Nuxt Fonts': /@nuxt\/fonts/,
    'Astro fonts config': /provider: 'local'/,
    JSON: /"sizeAdjust"/,
    'Preload tag': /rel="preload"/,
    'Font Loading API script': /document\.fonts\.load/,
  };
  for (const [label, pattern] of Object.entries(expected)) {
    await format.selectOption({ label });
    await expect(page.getByRole('region', { name: `Export: ${label}` })).toContainText(pattern);
  }
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Download: Export: Font Loading API script/ }).click();
  expect((await download).suggestedFilename()).toBe('font-loading.js');
});

test('the impact report is built from the same state as the matrix and can be downloaded', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByLabel('Format').selectOption({ label: 'Impact report (Markdown)' });
  const report = page.getByRole('region', { name: 'Export: Impact report (Markdown)' });
  await expect(report).toContainText('# Impact report: Source Sans Pro');
  await expect(report).toContainText('## Layout shift');
  await expect(report).toContainText('| Android |');
  await expect(report).toContainText('`size-adjust`');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Download: Export: Impact report/ }).click();
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
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.waitForTimeout(800);

  await page.reload();
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await expect(page.getByRole('button', { name: /^Remove: SourceSansPro-Regular/ })).toBeVisible();
  await expect(
    page.getByRole('checkbox', { name: 'Include Android in the stack' }),
  ).not.toBeChecked();

  await page.getByText('Save and share').click();
  await page.getByRole('button', { name: 'Copy share link' }).click();
  await expect(page.getByText('The link was copied.')).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/#s=[A-Za-z0-9_-]+$/);

  const fresh = await context.browser()?.newContext();
  if (!fresh) throw new Error('no browser');
  const other = await fresh.newPage();
  await other.goto(link);
  await other.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await other.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await expect(
    other.getByRole('checkbox', { name: 'Include Android in the stack' }),
  ).not.toBeChecked();
  await fresh.close();

  await page.getByRole('button', { name: 'Forget saved data' }).click();
  await expect(page.getByText(/were removed from this browser/)).toBeVisible();
  await page.reload();
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await expect(page.getByRole('button', { name: /^Remove: / })).toHaveCount(0);
});

test('a corrupt share link is ignored', async ({ page }) => {
  await page.goto('/en/#s=!!!not-a-state');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await expect(page.getByRole('region', { name: 'Fonts to adapt' })).toHaveCount(0);
  await expect(page.getByText('Your web font')).toBeVisible();
});
