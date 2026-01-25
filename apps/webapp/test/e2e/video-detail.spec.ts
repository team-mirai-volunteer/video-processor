import { expect, test } from '@playwright/test';

const mockVideoDetail = {
  id: '1',
  googleDriveFileId: 'abc123',
  googleDriveUrl: 'https://drive.google.com/file/d/abc123/view',
  title: 'テスト動画',
  description: 'テスト動画の説明',
  durationSeconds: 3600,
  fileSizeBytes: 1500000000,
  status: 'completed',
  errorMessage: null,
  clips: [],
  processingJobs: [
    {
      id: 'job-1',
      status: 'completed',
      clipInstructions: 'テスト指示',
      completedAt: new Date().toISOString(),
    },
  ],
  transcription: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

test.describe('Video Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    // APIレスポンスをモック
    await page.route('**/api/videos/1', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockVideoDetail),
      });
    });
    await page.route('**/api/videos/1/transcription', (route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not found' }),
      });
    });
    await page.route('**/api/videos/1/transcription/refined', (route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not found' }),
      });
    });
  });

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
    await expect(page.getByText('文字起こし', { exact: true })).toBeVisible();
  });

  test('should have link to open video in Google Drive', async ({ page }) => {
    await page.goto('/videos/1');

    // Google Driveで開くはButtonコンポーネント内のaタグ
    const driveLink = page.getByRole('link', { name: /Google Driveで開く/ });
    await expect(driveLink).toBeVisible();
    await expect(driveLink).toHaveAttribute('target', '_blank');
  });
});
