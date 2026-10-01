import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/*.config.*', '**/.turbo/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser, ...globals.es2022 },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['apps/server/**/*.ts'],
    languageOptions: {
      // Lets consistent-type-imports keep value imports for classes used in decorator metadata (Nest DI)
      parserOptions: { emitDecoratorMetadata: true, experimentalDecorators: true },
    },
    rules: {
      // Nest relies on classes used as DI tokens and on decorators with empty constructors
      '@typescript-eslint/no-extraneous-class': 'off',
      // Classes injected through constructor parameters must stay value imports (decorator metadata)
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
  prettier,
);
