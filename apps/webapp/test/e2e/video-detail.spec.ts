import { expect, test } from '@playwright/test';

// サーバーサイドモック（mock-backend-client.ts）を使用するため、
// ブラウザサイドでのAPIモックは不要

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

    // Check section title - CardTitleとしてテキストを検索
    await expect(page.getByText('動画情報', { exact: true })).toBeVisible();
  });

  test('should display clips section', async ({ page }) => {
    await page.goto('/videos/1');

    // Check section title
    await expect(page.getByText('切り抜きクリップ', { exact: true })).toBeVisible();
  });

  test('should display transcription section', async ({ page }) => {
    await page.goto('/videos/1');

    // Check section title - 文字起こしセクションは常に表示される
    // getByRole('heading') を使用して、セクションタイトルのみを対象にする（クリップ内の文字起こしラベルを除外）
    await expect(page.getByRole('heading', { name: '文字起こし' })).toBeVisible();
  });

  test('should have link to open video in Google Drive', async ({ page }) => {
    await page.goto('/videos/1');

    // Google Driveで開くはButtonコンポーネント内のaタグ
    // .first() を使用して、メインの動画リンクのみを対象にする（クリップのリンクを除外）
    const driveLink = page.getByRole('link', { name: /Google Driveで開く/ }).first();
    await expect(driveLink).toBeVisible();
    await expect(driveLink).toHaveAttribute('target', '_blank');
  });
});
