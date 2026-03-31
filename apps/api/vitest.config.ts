import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    fileParallelism: false,
    alias: {
      '@finance/shared': path.resolve(
        __dirname,
        '../../packages/shared/src/index.ts'
      ),
      '@': path.resolve(__dirname, './src'),
    },
  },
});