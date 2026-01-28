import path from 'node:path';
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
    alias: {
      '@clip-video': path.resolve(__dirname, './src/contexts/clip-video'),
      '@shared': path.resolve(__dirname, './src/contexts/shared'),
      '@shorts-gen': path.resolve(__dirname, './src/contexts/shorts-gen'),
      '@': path.resolve(__dirname, './src'),
    },
  },
});
