import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./src/testing/setup.ts'],
    fileParallelism: false,
    alias: [
      {
        find: /^@finance\/shared(\/.*)?$/,
        replacement: path.resolve(__dirname, '../../packages/shared/src') + '$1',
      },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
});