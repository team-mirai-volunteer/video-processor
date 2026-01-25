import { execSync } from 'node:child_process';

async function waitForDatabase(maxRetries = 30, intervalMs = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      execSync('docker exec video-processor-db-test pg_isready -U postgres', { stdio: 'ignore' });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  throw new Error('Database did not become ready');
}

export default async function globalSetup() {
  console.log('Starting E2E test environment...');

  // テスト用DBコンテナ起動
  execSync('docker compose -f apps/backend/docker-compose.test.yml up -d', {
    stdio: 'inherit',
    cwd: process.cwd().replace('/apps/webapp', ''),
  });

  // DB起動待ち
  await waitForDatabase();

  // スキーマ適用
  execSync('pnpm --filter backend db:push', {
    stdio: 'inherit',
    cwd: process.cwd().replace('/apps/webapp', ''),
    env: {
      ...process.env,
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/video_processor_test',
    },
  });

  // シードデータ投入
  execSync('pnpm --filter backend db:seed:e2e', {
    stdio: 'inherit',
    cwd: process.cwd().replace('/apps/webapp', ''),
    env: {
      ...process.env,
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/video_processor_test',
    },
  });

  console.log('E2E test environment ready');
}
