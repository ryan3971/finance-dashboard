import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // resolve.alias applies to both the main vite-node process (globalSetup) and
  // all test workers. test.alias only applies to workers.
  resolve: {
    alias: [
      {
        find: /^@finance\/shared(\/.*)?$/,
        replacement: path.resolve(__dirname, '../../packages/shared/src') + '$1',
      },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
  test: {
    globals: true,
    globalSetup: ['./src/testing/global-setup.ts'],
    setupFiles: ['./src/testing/setup.ts'],
    fileParallelism: true,
    env: { BCRYPT_ROUNDS: '4', ENABLE_AI_CATEGORIZATION: 'false' },
    exclude: [
      '**/node_modules/**',
      'src/features/imports/questrade-import.routes.test.ts',
      'src/features/imports/adapters/questrade/questrade.adapter.test.ts',
    ],
  },
});