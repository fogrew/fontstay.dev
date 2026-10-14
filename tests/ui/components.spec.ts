import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

async function openFixture(page: Page, locale = 'en') {
  await page.goto(`/${locale}/`);
  await expect(page.locator('.fixture')).toHaveAttribute('data-ready', 'true');
}

for (const locale of ['en', 'ru']) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${locale} UI components pass axe in ${theme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await openFixture(page, locale);
      await expect(page.getByRole('slider')).toHaveValue('105');
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
      const colors = await page.getByRole('spinbutton').evaluate((element) => ({
        border: getComputedStyle(element).borderTopColor,
        surface: getComputedStyle(element).backgroundColor,
        background: getComputedStyle(document.documentElement).backgroundColor,
      }));
      expect(contrast(colors.border, colors.surface)).toBeGreaterThanOrEqual(3);
      expect(contrast(colors.border, colors.background)).toBeGreaterThanOrEqual(3);
      await page.getByRole('tab', { name: 'CSS' }).click();
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze()
        ).violations,
      ).toEqual([]);
    });
  }
}

test('manual inputs pin values, reset restores auto, and all labels include units', async ({
  page,
}) => {
  await openFixture(page);
  const number = page.getByRole('spinbutton', { name: 'Size adjust (%)' });
  const slider = page.getByRole('slider', { name: 'Size adjust (%)' });
  await expect(number).toHaveValue('105');
  await number.fill('110');
  await number.press('Enter');
  await expect(slider).toHaveValue('110');
  await expect(page.getByRole('checkbox', { name: 'Auto' })).not.toBeChecked();
  await page.getByRole('button', { name: 'Recalculate' }).click();
  await expect(number).toHaveValue('110');
  await page.getByRole('button', { name: 'Reset to auto' }).click();
  await expect(number).toHaveValue('120');
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(number).toHaveValue('121');
  await page.getByRole('checkbox', { name: 'Auto' }).check();
  await expect(number).toHaveValue('120');
});

function contrast(first: string, second: string): number {
  const luminance = (color: string) => {
    const channels = color
      .match(/[\d.]+/g)
      ?.slice(0, 3)
      .map((value) => {
        const srgb = Number(value) / 255;
        return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
      });
    if (channels?.length !== 3) throw new Error(`Unexpected computed color: ${color}`);
    return (channels[0] ?? 0) * 0.2126 + (channels[1] ?? 0) * 0.7152 + (channels[2] ?? 0) * 0.0722;
  };
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test('tabs support roving focus, arrows, Home/End and focusable panels', async ({ page }) => {
  await openFixture(page);
  const first = page.getByRole('tab', { name: 'Preview' });
  const last = page.getByRole('tab', { name: 'CSS' });
  await first.focus();
  await page.keyboard.press('ArrowRight');
  await expect(last).toBeFocused();
  await expect(last).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(first).toBeFocused();
  await page.keyboard.press('End');
  await expect(last).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('tabpanel', { name: 'CSS' })).toBeFocused();
});

test('number drafts support sequential typing, decimals, empty drafts and bounds', async ({
  page,
}) => {
  await openFixture(page);
  const number = page.getByRole('spinbutton', { name: 'Size adjust (%)' });
  await number.focus();
  await number.press('ControlOrMeta+A');
  await number.pressSequentially('110.5');
  await expect(number).toHaveValue('110.5');
  await number.press('Enter');
  await expect(number).toHaveValue('110.5');
  await number.fill('');
  await number.press('Tab');
  await expect(number).toHaveValue('110.5');
  await number.fill('999');
  await number.press('Enter');
  await expect(number).toHaveValue('200');
});

test('tabbing through the number field without editing keeps automatic mode', async ({ page }) => {
  await openFixture(page);
  const auto = page.getByRole('checkbox', { name: 'Auto' });
  await expect(auto).toBeChecked();
  const number = page.getByRole('spinbutton', { name: 'Size adjust (%)' });
  await number.focus();
  await number.press('Tab');
  await expect(auto).toBeChecked();
});

test('the first keyboard stop skips the header to the single main landmark', async ({ page }) => {
  await openFixture(page);
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await skip.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await expect(page.getByRole('main')).toHaveCount(1);
});

test('copy uses the clipboard and reports permission failures accessibly', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openFixture(page);
  await page.getByRole('tab', { name: 'CSS' }).click();
  await page.getByRole('button', { name: 'Copy code' }).click();
  await expect(page.getByRole('status')).toHaveText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'font-family: "Example", sans-serif;',
  );
  await page.evaluate(() =>
    Object.defineProperty(navigator.clipboard, 'writeText', {
      value: () => Promise.reject(new Error('denied')),
    }),
  );
  await page.getByRole('button', { name: 'Copy code' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Copy failed. Select and copy the code manually.',
  );
});

test('select and disclosure work with the keyboard and text stays escaped', async ({ page }) => {
  await openFixture(page);
  const select = page.getByRole('combobox', { name: 'Fallback font' });
  await select.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(select).toHaveAttribute('data-value', 'helvetica');
  const summary = page.getByText('How it works', { exact: true });
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('<script>example</script>', { exact: true })).toBeVisible();
  expect(await page.locator('.ff-disclosure script').count()).toBe(0);
});

test('components fit small screens, show focus in forced colors and reduce motion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await openFixture(page);
  await page.getByRole('button', { name: 'Recalculate' }).focus();
  const style = await page.getByRole('button', { name: 'Recalculate' }).evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outline: style.outlineStyle,
      width: style.outlineWidth,
      duration: style.transitionDuration,
    };
  });
  expect(style.outline).toBe('solid');
  expect(Number.parseFloat(style.width)).toBeGreaterThanOrEqual(2);
  expect(style.duration).toBe('0s');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
