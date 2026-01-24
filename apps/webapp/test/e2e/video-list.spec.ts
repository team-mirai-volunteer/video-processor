import { expect, test } from '@playwright/test';

test.describe('Video List Page', () => {
  test('should display the video list page', async ({ page }) => {
    await page.goto('/');

    // Check page title
    await expect(page.locator('h1')).toContainText('動画一覧');

    // Check description
    await expect(page.getByText('登録された動画と処理状況を確認できます')).toBeVisible();
  });

  test('should have a link to submit new video', async ({ page }) => {
    await page.goto('/');

    const submitLink = page.getByRole('link', { name: '動画を登録' });
    await expect(submitLink).toBeVisible();

    await submitLink.click();
    await expect(page).toHaveURL('/submit');
  });

  test('should display header navigation', async ({ page }) => {
    await page.goto('/');

    // Check header logo
    await expect(page.getByRole('link', { name: /Video Processor/ })).toBeVisible();

    // Check navigation links
    await expect(page.getByRole('link', { name: '動画一覧' })).toBeVisible();
    await expect(page.getByRole('link', { name: '動画登録' })).toBeVisible();
  });

  test('should display footer', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Team Mirai Volunteer')).toBeVisible();
  });
});
