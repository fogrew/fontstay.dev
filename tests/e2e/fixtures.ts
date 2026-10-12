import { test as base, expect, type Locator, type Page } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    const violations: string[] = [];
    await page.exposeFunction('__reportCsp', (violation: string) => violations.push(violation));
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) => {
        (window as unknown as { __reportCsp: (value: string) => void }).__reportCsp(
          `${event.violatedDirective}: ${event.blockedURI} ${event.sourceFile}:${event.lineNumber}`,
        );
      });
    });
    await use(page);
    expect(violations).toEqual([]);
  },
});

export { expect };

const SYSTEM_NAMES: Record<string, RegExp> = {
  windows: /^Windows/,
  macos: /^macOS/,
  ios: /^iOS/,
  android: /^Android/,
  linux: /^Linux/,
  chromeos: /^Chrome ?OS/,
};

export async function selectSystem(page: Page, os: string) {
  const button = page.getByRole('button', { name: SYSTEM_NAMES[os] ?? os });
  if ((await button.getAttribute('aria-expanded')) === 'false') await button.click();
}

export async function openSupport(page: Page) {
  const button = page.getByRole('button', { name: 'Browser support', exact: true });
  if ((await button.getAttribute('aria-expanded')) === 'false') await button.click();
}

export async function openExport(page: Page) {
  const button = page.getByRole('button', { name: 'Export', exact: true });
  if ((await button.getAttribute('aria-expanded')) === 'false') await button.click();
}

export async function choose(
  box: Locator,
  option: string | { label: string | RegExp } | { index: number },
) {
  const button = box.first();
  const list = box.page().getByRole('listbox');
  const item =
    typeof option === 'string'
      ? list.locator(`[role="option"][data-value="${option}"]`)
      : 'label' in option
        ? list.getByRole('option', { name: option.label })
        : list.getByRole('option').nth(option.index);
  await expect(async () => {
    if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
    await item.click({ timeout: 2000 });
  }).toPass();
}

export async function listed(box: Locator): Promise<string> {
  await box.click();
  const texts = await box.page().getByRole('listbox').getByRole('option').allInnerTexts();
  await box.page().keyboard.press('Escape');
  return texts.join(' | ');
}
