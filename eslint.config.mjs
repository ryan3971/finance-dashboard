import { defineConfig } from 'eslint/config';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactRefreshPlugin from 'eslint-plugin-react-refresh';
// @ts-expect-error -- no type declarations shipped
import checkFilePlugin from 'eslint-plugin-check-file';
import globals from 'globals';

export default defineConfig(
  // ── Base: all files ────────────────────────────────────────────────────────
  // JS-only recommended rules applied globally (no type-checking required)
  eslint.configs.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,

  // ── TypeScript: type-checked rules scoped to TS/TSX files only ─────────────
  // recommendedTypeChecked requires a TS program, so it must be scoped to files
  // covered by tsconfig. Applying it globally causes errors on .js/.mjs files.
  {
    name: 'ts/type-checked',
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      // sort-imports handles member sort only; declaration sort is intentionally
      // disabled here to avoid conflicts if import/order is added in the future.
      'sort-imports': [
        'error',
        {
          ignoreCase: true,
          ignoreDeclarationSort: true, // defer declaration ordering to import/order if added
          ignoreMemberSort: false,
          memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
        },
      ],
      eqeqeq: ['error', 'always'],
      'no-console': 'warn',
      'no-throw-literal': 'off', // superseded by @typescript-eslint/only-throw-error (from recommendedTypeChecked)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'variable',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        {
          selector: 'parameter',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['UPPER_CASE', 'PascalCase'] },
        { selector: 'objectLiteralProperty', format: null },
        { selector: 'typeProperty', format: null },
        { selector: 'variable', modifiers: ['destructured'], format: null },
        { selector: 'import', format: ['camelCase', 'PascalCase'] },
      ],
    },
  },

  // ── Plain JS files: disable type-checked rules that require a TS program ──
  {
    name: 'js/disable-type-checked',
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // ── Web: feature boundary enforcement ─────────────────────────────────────
  {
    name: 'web/feature-boundaries',
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: { import: importPlugin },
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './apps/web/src/features/auth',
              from: './apps/web/src/features',
              except: ['./auth'],
            },
            {
              target: './apps/web/src/features/dashboard',
              from: './apps/web/src/features',
              except: ['./dashboard'],
            },
            {
              target: './apps/web/src/features/import',
              from: './apps/web/src/features',
              except: ['./import'],
            },
            {
              target: './apps/web/src/features/transactions',
              from: './apps/web/src/features',
              except: ['./transactions'],
            },
            {
              target: [
                './apps/web/src/components',
                './apps/web/src/hooks',
                './apps/web/src/lib',
                './packages/shared/src/*',
                './apps/web/src/utils',
              ],
              from: ['./apps/web/src/features'],
            },
          ],
        },
      ],
    },
  },

  // ── Web: .tsx filenames must be PascalCase (excludes main.tsx) ────────────
  {
    name: 'web/filename-tsx-pascal-case',
    files: ['apps/web/src/**/*.tsx'],
    ignores: ['apps/web/src/main.tsx'],
    plugins: { 'check-file': checkFilePlugin },
    rules: {
      'check-file/filename-naming-convention': [
        'error',
        { '**/*.tsx': 'PASCAL_CASE' },
        { ignoreMiddleExtensions: true },
      ],
    },
  },

  // ── Web: .ts filenames must be camelCase (excludes .d.ts) ─────────────────
  {
    name: 'web/filename-ts-camel-case',
    files: ['apps/web/src/**/*.ts'],
    ignores: ['apps/web/src/**/*.d.ts'],
    plugins: { 'check-file': checkFilePlugin },
    rules: {
      'check-file/filename-naming-convention': [
        'error',
        { '**/*.ts': 'CAMEL_CASE' },
        { ignoreMiddleExtensions: true },
      ],
    },
  },

  // ── Web: React rules + browser globals ────────────────────────────────────
  {
    name: 'web/react',
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooksPlugin,
      'react-refresh': reactRefreshPlugin,
    },
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // no-console is already set in ts/type-checked; not repeated here
    },
  },

  // ── API: node globals ──────────────────────────────────────────────────────
  {
    name: 'api/node-globals',
    files: ['apps/api/src/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // ── API: feature boundary enforcement ─────────────────────────────────────
  {
    name: 'api/feature-boundaries',
    files: ['apps/api/src/**/*.ts'],
    plugins: { import: importPlugin },
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './apps/api/src/features/accounts',
              from: './apps/api/src/features',
              except: ['./accounts'],
            },
            {
              target: './apps/api/src/features/auth',
              from: './apps/api/src/features',
              except: ['./auth'],
            },
            {
              target: './apps/api/src/features/categories',
              from: './apps/api/src/features',
              except: ['./categories'],
            },
            {
              target: './apps/api/src/features/dashboards',
              from: './apps/api/src/features',
              except: ['./dashboards'],
            },
            {
              target: './apps/api/src/features/imports',
              from: './apps/api/src/features',
              except: ['./imports'],
            },
            {
              target: './apps/api/src/features/investments',
              from: './apps/api/src/features',
              except: ['./investments'],
            },
            {
              target: './apps/api/src/features/tags',
              from: './apps/api/src/features',
              except: ['./tags'],
            },
            {
              target: './apps/api/src/features/transactions',
              from: './apps/api/src/features',
              except: ['./transactions'],
            },
            {
              target: './apps/api/src/features/transfers',
              from: './apps/api/src/features',
              except: ['./transfers'],
            },
            {
              target: [
                './apps/api/src/db',
                './apps/api/src/lib',
                './apps/api/src/middleware',
                './apps/api/src/pipelines',
                './apps/api/src/routes',
                './apps/api/src/types',
                './packages/shared/src/*',
              ],
              from: ['./apps/api/src/features'],
            },
          ],
        },
      ],
    },
  },

  // ── API: .ts filenames must be kebab-case ─────────────────────────────────
  {
    name: 'api/filename-ts-kebab-case',
    files: ['apps/api/src/**/*.ts'],
    plugins: { 'check-file': checkFilePlugin },
    rules: {
      'check-file/filename-naming-convention': [
        'error',
        { '**/*.ts': 'KEBAB_CASE' },
        { ignoreMiddleExtensions: true },
      ],
    },
  }
);
