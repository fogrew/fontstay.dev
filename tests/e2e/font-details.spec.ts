import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { closePanels, expect, test, waitForGenerator } from './fixtures';

const fonts = new URL('../fixtures/fonts/', import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  '$1',
);
const sourceSans = `${fonts}SourceSansPro-Regular.woff2`;
const mada = `${fonts}Mada-VF.ttf`;
const fira = `${fonts}FiraSans-Regular.ttf`;

async function openDetails(page: Page, file: string, locale = 'en', heading = 'Font details') {
  await page.goto(`/${locale}/`);
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(file);
  await closePanels(page);
  await page.getByRole('button', { name: heading, exact: true }).click();
}

test('the details panel lists the features, name table and languages of a font', async ({
  page,
}) => {
  await openDetails(page, sourceSans);
  const overview = page.getByRole('tabpanel', { name: 'Overview' });
  await expect(overview).toContainText('Paul D. Hunt');
  await expect(overview).toContainText('Adobe Systems Incorporated');
  await expect(overview.getByRole('link', { name: /OFL/ }).first()).toHaveAttribute(
    'href',
    'http://scripts.sil.org/OFL',
  );

  await page.getByRole('tab', { name: 'Features' }).click();
  const features = page.getByRole('tabpanel', { name: 'Features' });
  for (const tag of ['liga', 'kern', 'smcp', 'onum', 'ss01']) {
    await expect(features.locator('.ff-details__tag', { hasText: tag })).toBeVisible();
  }
  await expect(features.getByRole('checkbox', { name: /^liga / })).toBeChecked();
  await expect(features.getByRole('checkbox', { name: /^smcp / })).not.toBeChecked();

  await page.getByRole('tab', { name: 'Languages' }).click();
  const languages = page.getByRole('tabpanel', { name: 'Languages' });
  await expect(languages.getByRole('listitem').filter({ hasText: /^English$/ })).toBeVisible();
  await expect(languages.getByRole('listitem').filter({ hasText: /^Russian$/ })).toBeVisible();
  await expect(languages.getByRole('listitem').filter({ hasText: /^Arabic$/ })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Variable axes' }).click();
  await expect(page.getByText('This font has no variable axes.')).toBeVisible();
});

test('ticking features and moving axes generates the matching CSS', async ({ page }) => {
  await openDetails(page, sourceSans);
  await page.getByRole('tab', { name: 'CSS' }).click();
  const css = page.getByRole('tabpanel', { name: 'CSS' });
  await expect(css).toContainText('Nothing selected yet');

  await page.getByRole('tab', { name: 'Features' }).click();
  const features = page.getByRole('tabpanel', { name: 'Features' });
  await features.getByRole('checkbox', { name: /^smcp / }).check();
  await features.getByRole('checkbox', { name: /^onum / }).check();
  await features.getByRole('checkbox', { name: /^ss01 / }).check();
  await features.getByRole('checkbox', { name: /^liga / }).uncheck();
  await expect(page.locator('.ff-details__stage')).toHaveCSS(
    'font-feature-settings',
    '"liga" 0, "onum", "smcp", "ss01"',
  );

  await page.getByRole('tab', { name: 'CSS' }).click();
  await expect(css).toContainText('font-variant-caps: small-caps;');
  await expect(css).toContainText('font-variant-numeric: oldstyle-nums;');
  await expect(css).toContainText('font-feature-settings: "liga" 0, "ss01" 1;');
  await expect(css).not.toContainText('font-variation-settings');

  await page.getByRole('button', { name: 'Reset selection' }).click();
  await expect(css).toContainText('Nothing selected yet');
});

test('a variable font lists its axes and named instances and writes font-variation-settings', async ({
  page,
}) => {
  await openDetails(page, mada);
  await page.getByRole('tab', { name: 'Variable axes' }).click();
  const axes = page.getByRole('tabpanel', { name: 'Variable axes' });
  await expect(axes).toContainText('Weight (wght)');
  await expect(axes).toContainText('100 to 1,000, default 520');
  for (const name of ['Light', 'Regular', 'SemiBold', 'Bold', 'Black']) {
    await expect(axes.getByRole('button', { name, exact: true })).toBeVisible();
  }

  await axes.getByRole('button', { name: 'Bold', exact: true }).click();
  await expect(axes.getByRole('button', { name: 'Bold', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.ff-details__stage')).toHaveCSS(
    'font-variation-settings',
    '"wght" 824',
  );

  await page.getByRole('tab', { name: 'CSS' }).click();
  await expect(page.getByRole('tabpanel', { name: 'CSS' })).toContainText(
    'font-variation-settings: "wght" 824;',
  );
});

test('the details panel is localized and passes the accessibility audit', async ({ page }) => {
  await openDetails(page, sourceSans, 'ru', 'Сведения о шрифте');
  await expect(page.getByRole('tab', { name: 'Возможности' })).toBeVisible();
  await page.getByRole('tab', { name: 'Языки' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: /^русский$/ })).toBeVisible();

  await page.getByRole('tab', { name: 'Возможности' }).click();
  const results = await new AxeBuilder({ page })
    .include('.ff-details')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('a static TrueType font lists its stylistic sets and writes ligature and caps variants', async ({
  page,
}) => {
  await openDetails(page, fira);
  await page.getByRole('tab', { name: 'Features' }).click();
  const features = page.getByRole('tabpanel', { name: 'Features' });
  for (const tag of ['liga', 'kern', 'smcp', 'ss01', 'frac']) {
    await expect(features.locator('.ff-details__tag', { hasText: tag })).toBeVisible();
  }
  await features.getByRole('checkbox', { name: /^liga / }).uncheck();
  await features.getByRole('checkbox', { name: /^clig / }).uncheck();
  await features.getByRole('checkbox', { name: /^smcp / }).check();
  await features.getByRole('checkbox', { name: /^c2sc / }).check();
  await page.getByRole('tab', { name: 'CSS' }).click();
  const css = page.getByRole('tabpanel', { name: 'CSS' });
  await expect(css).toContainText('font-variant-ligatures: no-common-ligatures;');
  await expect(css).toContainText('font-variant-caps: all-small-caps;');
});
