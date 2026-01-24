import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

config();

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/**/*.d.ts'],
    },
  },
});
