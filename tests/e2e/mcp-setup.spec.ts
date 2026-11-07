import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test('MCP setup tabs switch with arrows and offer verified install URLs', async ({ page }) => {
  await page.goto('/en/mcp/');
  const tabs = page.getByRole('tablist', { name: 'Setup' }).getByRole('tab');
  await expect(tabs).toHaveCount(5);
  await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
  await tabs.nth(0).focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(tabs.nth(4)).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.nth(0)).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(tabs.nth(4)).toBeFocused();
  await page.keyboard.press('Home');
  await expect(tabs.nth(0)).toBeFocused();

  await tabs.nth(2).click();
  const cursor = await page.getByRole('link', { name: 'Add to Cursor' }).getAttribute('href');
  const cursorUrl = new URL(cursor ?? '');
  expect(`${cursorUrl.protocol}//${cursorUrl.host}${cursorUrl.pathname}`).toBe(
    'cursor://anysphere.cursor-deeplink/mcp/install',
  );
  expect(cursorUrl.searchParams.get('name')).toBe('fontstay');
  expect(
    JSON.parse(Buffer.from(cursorUrl.searchParams.get('config') ?? '', 'base64').toString()),
  ).toEqual({
    command: 'npx',
    args: ['-y', 'fontstay', 'mcp'],
  });

  await tabs.nth(3).click();
  const vscode = await page.getByRole('link', { name: 'Add to VS Code' }).getAttribute('href');
  expect(vscode?.startsWith('vscode:mcp/install?')).toBe(true);
  expect(JSON.parse(decodeURIComponent(vscode?.split('?')[1] ?? ''))).toEqual({
    name: 'fontstay',
    command: 'npx',
    args: ['-y', 'fontstay', 'mcp'],
  });

  for (let index = 0; index < 5; index++) {
    await tabs.nth(index).click();
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations, `tab ${index}`).toEqual([]);
  }
});
