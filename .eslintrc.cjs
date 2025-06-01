module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'prettier',
  ],
  env: {
    node: true,
    es2021: true,
  },
  rules: {
    // === UNUSED CODE DETECTION ===
    '@typescript-eslint/no-unused-vars': ['warn', {
      args: 'after-used',
      varsIgnorePattern: '^_',
      argsIgnorePattern: '^_',
      destructuredArrayIgnorePattern: '^_'
    }],
    'no-unused-vars': 'off', // Turn off base rule for TypeScript
    '@typescript-eslint/no-unused-expressions': 'warn',
    'no-unreachable': 'warn',
    'no-unreachable-loop': 'warn',
    'no-useless-return': 'warn',
    'no-useless-escape': 'warn',
    'no-useless-concat': 'warn',
    'no-useless-computed-key': 'warn',
    'no-useless-rename': 'warn',
    'import/no-unused-modules': 'warn',

    // === TYPESCRIPT BEST PRACTICES ===
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    '@typescript-eslint/no-unnecessary-condition': 'warn',
    '@typescript-eslint/prefer-as-const': 'error',
    '@typescript-eslint/consistent-type-imports': ['error', {
      prefer: 'type-imports',
      disallowTypeAnnotations: false
    }],
    '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
    '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
    '@typescript-eslint/prefer-function-type': 'error',

    // === CODE QUALITY & BEST PRACTICES ===
    'eqeqeq': ['error', 'always'],
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-arrow-callback': 'error',
    'prefer-template': 'error',
    'prefer-destructuring': ['warn', {
      array: true,
      object: true
    }],
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-alert': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'curly': 'error',
    'default-case': 'warn',
    'no-fallthrough': 'error',
    'no-duplicate-imports': 'error',
    'no-magic-numbers': ['warn', {
      ignore: [-1, 0, 1, 2],
      ignoreArrayIndexes: true,
      ignoreDefaultValues: true
    }],

    // === ASYNC/PROMISE BEST PRACTICES ===
    'no-async-promise-executor': 'error',
    'no-await-in-loop': 'warn',
    'no-promise-executor-return': 'error',
    'prefer-promise-reject-errors': 'error',
    'require-atomic-updates': 'error',

    // === IMPORT/EXPORT BEST PRACTICES ===
    'import/order': ['error', {
      groups: [
        'builtin',
        'external',
        'internal',
        'parent',
        'sibling',
        'index'
      ],
      'newlines-between': 'always',
      alphabetize: {
        order: 'asc',
        caseInsensitive: true
      }
    }],
    'import/no-duplicates': 'error',
    'import/no-unresolved': 'error',
    'import/no-cycle': 'error',
    'import/no-self-import': 'error',
    'import/first': 'error',
    'import/exports-last': 'error',
    'import/newline-after-import': 'error',

    // === PERFORMANCE & SECURITY ===
    'no-loop-func': 'error',
    'no-new-func': 'error',
    'no-new-wrappers': 'error',
    'no-proto': 'error',
    'no-script-url': 'error',
    'radix': 'error',

    // === ERROR PREVENTION ===
    'no-cond-assign': 'error',
    'no-constant-condition': 'error',
    'no-dupe-args': 'error',
    'no-dupe-keys': 'error',
    'no-duplicate-case': 'error',
    'no-empty-character-class': 'error',
    'no-ex-assign': 'error',
    'no-extra-boolean-cast': 'error',
    'no-func-assign': 'error',
    'no-invalid-regexp': 'error',
    'no-sparse-arrays': 'error',
    'use-isnan': 'error',
    'valid-typeof': 'error',
  },
};