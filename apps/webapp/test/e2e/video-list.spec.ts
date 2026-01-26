import { expect, test } from '@playwright/test';

test.describe('Video List Page', () => {
  test('should load without errors', async ({ page }) => {
    await page.goto('/');

    // ページが正常にロードされ、タイトルが表示されることを確認
    await expect(page.locator('h1')).toContainText('動画一覧');
  });
});
