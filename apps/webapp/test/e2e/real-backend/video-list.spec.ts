import { expect, test } from '@playwright/test';
import { E2E_TEST_DATA } from '../helpers/test-data';

test.describe('Video List Page - Real Backend', () => {
  test('should display the video list page with seeded data', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('h1')).toContainText('動画一覧');

    // シードデータの動画が表示されることを確認
    await expect(page.getByText(E2E_TEST_DATA.videos.completed.title)).toBeVisible();
    await expect(page.getByText(E2E_TEST_DATA.videos.processing.title)).toBeVisible();
    await expect(page.getByText(E2E_TEST_DATA.videos.pending.title)).toBeVisible();
  });

  test('should display header navigation', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('link', { name: /Video Processor/ })).toBeVisible();
    await expect(page.getByRole('link', { name: '動画一覧' })).toBeVisible();
    await expect(page.getByRole('link', { name: '動画登録' })).toBeVisible();
  });

  test('should have a link to submit new video', async ({ page }) => {
    await page.goto('/');

    const submitLink = page.getByRole('link', { name: '動画を登録' });
    await expect(submitLink).toBeVisible();

    await submitLink.click();
    await expect(page).toHaveURL('/submit');
  });

  test('should display footer', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Team Mirai Volunteer')).toBeVisible();
  });
});
