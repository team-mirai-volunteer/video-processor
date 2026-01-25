import { execSync } from 'node:child_process';

export default async function globalTeardown() {
  console.log('Cleaning up E2E test environment...');

  // テスト用DBコンテナ停止
  execSync('docker compose -f apps/backend/docker-compose.test.yml down -v', {
    stdio: 'inherit',
    cwd: process.cwd().replace('/apps/webapp', ''),
  });

  console.log('E2E test environment cleaned up');
}
