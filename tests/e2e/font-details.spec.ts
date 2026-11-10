import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, openPopover, openStep, test, waitForGenerator } from './fixtures';

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
  await openStep(page, 'inputs');
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  await page
    .locator('[aria-labelledby="ff-details-heading"] .ff-collapsible__toggle')
    .first()
    .click();
}

test('the details panel lists the features, name table and languages of a font', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await openDetails(page, sourceSans);
  const overview = page.getByRole('tabpanel', { name: 'Overview' });
  await expect(overview).toContainText('Paul D. Hunt');
  await expect(overview).toContainText('Adobe Systems Incorporated');
  await expect(overview).toContainText('SIL Open Font License 1.1');
  await expect(overview).toContainText('Installable');
  await expect(overview.getByRole('link', { name: /OFL/ }).first()).toHaveAttribute(
    'href',
    'http://scripts.sil.org/OFL',
  );

  await page.getByRole('tab', { name: 'Features' }).click();
  const features = page.getByRole('tabpanel', { name: 'Features' });
  for (const tag of ['liga', 'kern', 'smcp', 'onum', 'ss01']) {
    await expect(features.locator('.ff-details__tag', { hasText: tag })).toBeVisible();
  }
  await expect(features).toContainText('On by default');

  await page.getByRole('tab', { name: 'Languages' }).click();
  const languages = page.getByRole('tabpanel', { name: 'Languages' });
  await expect(languages.getByRole('listitem').filter({ hasText: /^English$/ })).toBeVisible();
  await expect(languages.getByRole('listitem').filter({ hasText: /^Russian$/ })).toBeVisible();
  await expect(languages.getByRole('listitem').filter({ hasText: /^Arabic$/ })).toHaveCount(0);

  await expect(page.getByRole('tab', { name: 'Axes' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Colour' })).toHaveCount(0);
  const tabs = page.getByRole('tablist', { name: 'Font detail sections' });
  expect(await tabs.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
});

const pagesFeatureSettings = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.ff-article:not([data-probe])')].map(
      (element) => getComputedStyle(element).fontFeatureSettings,
    ),
  );

async function openControls(page: Page, file: string) {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(file);
  await openPopover(page, 'Settings');
  return page.getByRole('group', { name: 'Font features and axes' });
}

test('toolbar feature controls restyle the article and write the matching CSS', async ({
  page,
}) => {
  const controls = await openControls(page, sourceSans);
  await controls.getByRole('checkbox', { name: /^smcp / }).check();
  await controls.getByRole('checkbox', { name: /^onum / }).check();
  await controls.getByRole('checkbox', { name: /^liga / }).uncheck();
  await expect
    .poll(async () => (await pagesFeatureSettings(page)).some((value) => value.includes('"smcp"')))
    .toBe(true);
  await expect(controls).toContainText('font-variant-caps: small-caps;');
  await expect(controls).toContainText('font-variant-numeric: oldstyle-nums;');
  await expect(controls).toContainText('font-feature-settings: "liga" 0;');
  await expect(controls).not.toContainText('font-variation-settings');

  await controls.getByRole('button', { name: 'Reset selection' }).click();
  await expect(controls).not.toContainText('font-variant-caps');
  expect((await pagesFeatureSettings(page)).some((value) => value.includes('"smcp"'))).toBe(false);
});

test('a variable font gets axis sliders and named instances in the toolbar', async ({ page }) => {
  const controls = await openControls(page, mada);
  for (const name of ['Light', 'Regular', 'SemiBold', 'Bold', 'Black']) {
    await expect(controls.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await controls.getByRole('button', { name: 'Bold', exact: true }).click();
  await expect(controls.getByRole('button', { name: 'Bold', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(controls).toContainText('font-variation-settings: "wght" 824;');
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('.ff-article:not([data-probe])')].some(
          (element) => getComputedStyle(element).fontVariationSettings.includes('824'),
        ),
      ),
    )
    .toBe(true);
});

test('a variable font lists its axes in the details panel', async ({ page }) => {
  await openDetails(page, mada);
  await page.getByRole('tab', { name: 'Axes' }).click();
  const axes = page.getByRole('tabpanel', { name: 'Axes' });
  await expect(axes).toContainText('Weight (wght)');
  await expect(axes).toContainText('100 to 1,000, default 520');
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
});

test('static TrueType ligature and caps variants are written in the toolbar CSS', async ({
  page,
}) => {
  const controls = await openControls(page, fira);
  await controls.getByRole('checkbox', { name: /^calt / }).uncheck();
  await controls.getByRole('checkbox', { name: /^dlig / }).check();
  await controls.getByRole('checkbox', { name: /^smcp / }).check();
  await controls.getByRole('checkbox', { name: /^c2sc / }).check();
  await expect(controls).toContainText(
    'font-variant-ligatures: no-contextual discretionary-ligatures;',
  );
  await expect(controls).toContainText('font-variant-caps: all-small-caps;');
});

test('font details live in Inputs, one group per font, and not under the article', async ({
  page,
}) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles([sourceSans, fira]);
  await openStep(page, 'inputs');
  const groups = page.locator('[aria-labelledby="ff-details-heading"] .ff-collapsible__toggle');
  await expect(groups).toHaveCount(2);
  await groups.first().click();
  await expect(groups.first()).toHaveAttribute('aria-expanded', 'true');
  await expect(groups.last()).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('button', { name: 'Font details', exact: true })).toHaveCount(0);
});

test('the cross in the font details removes the font and keeps the narrow layout', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await openDetails(page, sourceSans);
  const remove = page.getByRole('button', { name: /^Remove from the fonts:/ });
  await expect(remove).toBeVisible();
  const heading = page.getByRole('heading', { name: 'Font details', exact: true });
  await remove.focus();
  await expect(remove).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(heading).toBeHidden();
  await expect(page.locator('#ff-input-text')).toBeFocused();
  await expect(page.getByRole('button', { name: /^Remove: SourceSans/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('removing a font moves focus to the next font toggle', async ({ page }) => {
  await openDetails(page, sourceSans);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles([fira, mada]);
  const detailToggles = page.locator(
    '[aria-labelledby="ff-details-heading"] .ff-collapsible__toggle',
  );
  await expect(detailToggles).toHaveCount(3);
  const second = await detailToggles.nth(1).textContent();
  await page
    .getByRole('button', { name: /^Remove from the fonts:/ })
    .first()
    .press('Enter');
  await expect(detailToggles).toHaveCount(2);
  await expect(detailToggles.first()).toBeFocused();
  await expect(detailToggles.first()).toHaveText(second ?? '');

  await openStep(page, 'tuning');
  const fitRemove = page.getByRole('button', { name: /^Remove: .+\.(ttf|woff2)$/ });
  await expect(fitRemove).toHaveCount(2);
  const fitToggles = page.locator('.ff-collapsible__toggle[data-toggle-id^="fit-"]');
  const remaining = await fitToggles.nth(1).textContent();
  await fitRemove.first().press('Enter');
  await expect(fitRemove).toHaveCount(1);
  await expect(fitToggles).toBeFocused();
  await expect(fitToggles).toHaveText(remaining ?? '');
  await fitRemove.press('Enter');
  await expect(
    page.locator('.ff-dock__column[data-id="inputs"] .ff-dock__heading button'),
  ).toBeFocused();
});

test('added faces are told apart by a face line and removed with a centred trash icon', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await openDetails(page, sourceSans);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles([fira]);
  const details = page.locator('[aria-labelledby="ff-details-heading"] .ff-collapsible__toggle');
  await expect(details).toHaveCount(2);
  for (const toggle of await details.all()) {
    await expect(toggle.locator('.ff-collapsible__detail')).toHaveText(/^\d{3} (Regular|Italic)/);
  }
  const remove = page.getByRole('button', { name: /^Remove from the fonts:/ }).first();
  await expect(remove.locator('svg.ff-icon')).toBeVisible();
  await expect(remove).not.toContainText('×');
  const [button, icon] = await Promise.all([
    remove.boundingBox(),
    remove.locator('svg').boundingBox(),
  ]);
  if (!button || !icon) throw new Error('missing boxes');
  expect(Math.abs(button.x + button.width / 2 - (icon.x + icon.width / 2))).toBeLessThan(1);
  expect(Math.abs(button.y + button.height / 2 - (icon.y + icon.height / 2))).toBeLessThan(1);
  await openStep(page, 'tuning');
  const fit = page.locator('.ff-collapsible__toggle[data-toggle-id^="fit-"]');
  await expect(fit).toHaveCount(2);
  await expect(fit.first().locator('.ff-collapsible__detail')).toHaveText(
    /^\d{3} (Regular|Italic)/,
  );
  await expect(
    page
      .getByRole('button', { name: /^Remove: .+\.(ttf|woff2)$/ })
      .first()
      .locator('svg.ff-icon'),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
