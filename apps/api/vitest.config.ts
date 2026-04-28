import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./src/testing/setup.ts'],
    fileParallelism: false,
    env: { BCRYPT_ROUNDS: '4' },
    exclude: [
      '**/node_modules/**',
      'src/features/imports/questrade-import.routes.test.ts',
      'src/features/imports/adapters/questrade/questrade.adapter.test.ts',
      'src/pipelines/categorization/anthropic-provider.test.ts',
      'src/pipelines/categorization/openai-provider.test.ts',
    ],
    alias: [
      {
        find: /^@finance\/shared(\/.*)?$/,
        replacement: path.resolve(__dirname, '../../packages/shared/src') + '$1',
      },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
});