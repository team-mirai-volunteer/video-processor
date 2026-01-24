import { expect, test } from '@playwright/test';

test.describe('Video Detail Page', () => {
  test('should have back to list button', async ({ page }) => {
    await page.goto('/videos/1');

    const backLink = page.getByRole('link', { name: '一覧に戻る' });
    await expect(backLink).toBeVisible();

    await backLink.click();
    await expect(page).toHaveURL('/');
  });

  test('should display video information section', async ({ page }) => {
    await page.goto('/videos/1');

    // Check section title
    await expect(page.getByRole('heading', { name: '動画情報' })).toBeVisible();
  });

  test('should display clips section', async ({ page }) => {
    await page.goto('/videos/1');

    // Check section title
    await expect(page.getByRole('heading', { name: '切り抜きクリップ' })).toBeVisible();
  });

  test('should display processing jobs section', async ({ page }) => {
    await page.goto('/videos/1');

    // Check section title
    await expect(page.getByRole('heading', { name: '処理ジョブ' })).toBeVisible();
  });

  test('should have link to open video in Google Drive', async ({ page }) => {
    await page.goto('/videos/1');

    const driveLink = page.getByRole('link', { name: 'Google Driveで開く' }).first();
    await expect(driveLink).toBeVisible();
    await expect(driveLink).toHaveAttribute('target', '_blank');
  });
});
