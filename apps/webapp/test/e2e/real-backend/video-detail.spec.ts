import { expect, test } from '@playwright/test';
import { E2E_TEST_DATA } from '../helpers/test-data';

test.describe('Video Detail Page - Real Backend', () => {
  test('should display completed video with clips', async ({ page }) => {
    const { id, title } = E2E_TEST_DATA.videos.completed;
    await page.goto(`/videos/${id}`);

    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText('切り抜きクリップ', { exact: true })).toBeVisible();
    await expect(page.getByText(E2E_TEST_DATA.clips.clip1.title)).toBeVisible();
    await expect(page.getByText(E2E_TEST_DATA.clips.clip2.title)).toBeVisible();
  });

  test('should display transcription for completed video', async ({ page }) => {
    await page.goto(`/videos/${E2E_TEST_DATA.videos.completed.id}`);

    await expect(page.getByRole('heading', { name: '文字起こし' })).toBeVisible();
    await expect(page.getByText('これはE2Eテスト用の文字起こしです')).toBeVisible();
  });

  test('should display video information section', async ({ page }) => {
    await page.goto(`/videos/${E2E_TEST_DATA.videos.completed.id}`);

    await expect(page.getByText('動画情報', { exact: true })).toBeVisible();
  });

  test('should have back to list button', async ({ page }) => {
    await page.goto(`/videos/${E2E_TEST_DATA.videos.completed.id}`);

    const backLink = page.getByRole('link', { name: '一覧に戻る' });
    await expect(backLink).toBeVisible();

    await backLink.click();
    await expect(page).toHaveURL('/');
  });

  test('should have link to open video in Google Drive', async ({ page }) => {
    await page.goto(`/videos/${E2E_TEST_DATA.videos.completed.id}`);

    const driveLink = page.getByRole('link', { name: /Google Driveで開く/ }).first();
    await expect(driveLink).toBeVisible();
    await expect(driveLink).toHaveAttribute('target', '_blank');
  });

  test('should show error message for failed video', async ({ page }) => {
    await page.goto(`/videos/${E2E_TEST_DATA.videos.error.id}`);

    await expect(page.getByText('テスト用のエラーメッセージ')).toBeVisible();
  });

  test('should display processing video status', async ({ page }) => {
    await page.goto(`/videos/${E2E_TEST_DATA.videos.processing.id}`);

    await expect(page.getByText(E2E_TEST_DATA.videos.processing.title)).toBeVisible();
  });

  test('should display pending video status', async ({ page }) => {
    await page.goto(`/videos/${E2E_TEST_DATA.videos.pending.id}`);

    await expect(page.getByText(E2E_TEST_DATA.videos.pending.title)).toBeVisible();
  });
});
