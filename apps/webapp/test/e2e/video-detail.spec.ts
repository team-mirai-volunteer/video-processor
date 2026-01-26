import { expect, test } from '@playwright/test';

test.describe('Video Detail Page', () => {
  test('should load without errors', async ({ page }) => {
    await page.goto('/videos/1');

    // ページが正常にロードされ、動画情報セクションが表示されることを確認
    await expect(page.getByText('動画情報', { exact: true })).toBeVisible();
  });
});
