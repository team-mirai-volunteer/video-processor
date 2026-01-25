import { expect, test } from '@playwright/test';

test.describe('Video Submit Page - Real Backend', () => {
  test('should display the submit form', async ({ page }) => {
    await page.goto('/submit');

    await expect(page.locator('h1')).toContainText('動画登録');
    await expect(page.getByLabel('Google Drive URL')).toBeVisible();
  });

  test('should have submit button disabled when form is empty', async ({ page }) => {
    await page.goto('/submit');

    const submitButton = page.getByRole('button', { name: '動画を登録' });
    await expect(submitButton).toBeDisabled();
  });

  test('should enable submit button when form is filled correctly', async ({ page }) => {
    await page.goto('/submit');

    await page.getByLabel('Google Drive URL').fill('https://drive.google.com/file/d/abc123/view');

    const submitButton = page.getByRole('button', { name: '動画を登録' });
    await expect(submitButton).toBeEnabled();
  });

  test('should submit a new video and redirect to detail page', async ({ page }) => {
    await page.goto('/submit');

    // 新しい動画URLを入力（モッククライアントが処理）
    const testFileId = `test-${Date.now()}`;
    await page
      .getByLabel('Google Drive URL')
      .fill(`https://drive.google.com/file/d/${testFileId}/view`);

    // 送信
    await page.getByRole('button', { name: '動画を登録' }).click();

    // 動画詳細ページへリダイレクトされることを確認
    await expect(page).toHaveURL(/\/videos\/[a-f0-9-]+/);

    // 新しい動画が表示されることを確認
    await expect(page.getByText('動画情報', { exact: true })).toBeVisible();
  });

  test('should have cancel button that navigates back', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: '動画を登録' }).click();

    await expect(page).toHaveURL('/submit');

    await page.getByRole('button', { name: 'キャンセル' }).click();
    await expect(page).toHaveURL('/');
  });

  test('should show helper text for inputs', async ({ page }) => {
    await page.goto('/submit');

    await expect(
      page.getByText('Google Driveで共有されている動画のURLを入力してください')
    ).toBeVisible();
  });
});
