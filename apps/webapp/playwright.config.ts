import { defineConfig, devices } from '@playwright/test';

const useRealBackend = process.env.E2E_USE_REAL_BACKEND === 'true';

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: !useRealBackend,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: useRealBackend ? 1 : process.env.CI ? 1 : undefined,
  reporter: 'html',

  globalSetup: useRealBackend ? './test/e2e/global-setup.ts' : undefined,
  globalTeardown: useRealBackend ? './test/e2e/global-teardown.ts' : undefined,

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: useRealBackend
    ? [
        {
          command: 'pnpm --filter backend dev:test',
          url: 'http://localhost:8081/health',
          reuseExistingServer: !process.env.CI,
          env: {
            DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/video_processor_test',
            PORT: '8081',
            USE_MOCK_GOOGLE_DRIVE: 'true',
            USE_MOCK_AI: 'true',
            TEMP_STORAGE_TYPE: 'local',
          },
        },
        {
          command: 'pnpm --filter @video-processor/webapp dev',
          url: 'http://localhost:3000',
          reuseExistingServer: !process.env.CI,
          env: {
            NEXT_PUBLIC_API_URL: 'http://localhost:8081',
            NEXT_PUBLIC_USE_MOCK: 'false',
          },
        },
      ]
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        env: {
          NEXT_PUBLIC_USE_MOCK: 'true',
        },
      },
});
