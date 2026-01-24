import { expect, test } from '@playwright/test';

test.describe('Video Submit Page', () => {
  test('should display the submit form', async ({ page }) => {
    await page.goto('/submit');

    // Check page title
    await expect(page.locator('h1')).toContainText('動画登録');

    // Check form fields
    await expect(page.getByLabel('Google Drive URL')).toBeVisible();
    await expect(page.getByLabel('切り抜き指示')).toBeVisible();
  });

  test('should have submit button disabled when form is empty', async ({ page }) => {
    await page.goto('/submit');

    const submitButton = page.getByRole('button', { name: '動画を登録' });
    await expect(submitButton).toBeDisabled();
  });

  test('should enable submit button when form is filled correctly', async ({ page }) => {
    await page.goto('/submit');

    // Fill in the form
    await page.getByLabel('Google Drive URL').fill('https://drive.google.com/file/d/abc123/view');
    await page.getByLabel('切り抜き指示').fill('自己紹介部分を切り抜いてください');

    const submitButton = page.getByRole('button', { name: '動画を登録' });
    await expect(submitButton).toBeEnabled();
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

    await expect(
      page.getByText('どの箇所を切り抜きたいか、具体的に指示してください')
    ).toBeVisible();
  });
});
