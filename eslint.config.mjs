import { defineConfig } from 'eslint/config';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactRefreshPlugin from 'eslint-plugin-react-refresh';
// @ts-ignore -- no type declarations shipped
import checkFilePlugin from 'eslint-plugin-check-file';
import globals from 'globals';

export default defineConfig(
  // ── Base: all TS/JS files ──────────────────────────────────────────────────
  eslint.configs.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      'sort-imports': [
        'error',
        {
          ignoreCase: true,
          ignoreDeclarationSort: false,
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

  // ── Web: feature boundary enforcement ─────────────────────────────────────
  {
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
      'no-console': 'warn',
    },
  },

  // ── API: node globals ──────────────────────────────────────────────────────
  {
    files: ['apps/api/src/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // ── API: feature boundary enforcement ─────────────────────────────────────
  {
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
