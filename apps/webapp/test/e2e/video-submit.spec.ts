import { expect, test } from '@playwright/test';

test.describe('Video Submit Page', () => {
  test('should load without errors', async ({ page }) => {
    await page.goto('/submit');

    // ページが正常にロードされ、タイトルが表示されることを確認
    await expect(page.locator('h1')).toContainText('動画登録');
  });
});
