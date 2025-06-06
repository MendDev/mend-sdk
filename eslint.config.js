import parser from '@typescript-eslint/parser';
import plugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    files: ['src/**/*.ts'],
    ignores: ['dist/**'],
    languageOptions: {
      parser,
      parserOptions: {
        project: './tsconfig.eslint.json',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': plugin,
    },
    rules: {
      // Add custom rules here
    },
  },
];
