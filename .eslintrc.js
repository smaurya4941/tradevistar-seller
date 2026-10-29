module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: [
    'node_modules/',
    'android/',
    'ios/',
    'coverage/',
    'src/design/icons/glyphMap.ts',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],
    '@typescript-eslint/no-explicit-any': 'error',
    // `void promise` marks a deliberately un-awaited call; only as a statement.
    'no-void': ['error', { allowAsStatement: true }],
    'no-console': 'error',
    eqeqeq: ['error', 'smart'],
    'react-hooks/exhaustive-deps': 'error',
  },
  overrides: [
    {
      // Shared with the web portal's code style, which formats with double quotes.
      files: ['packages/seller-api/**/*.ts'],
      rules: { quotes: 'off', 'no-bitwise': 'off' },
    },
    {
      files: ['**/__tests__/**', 'jest.setup.js'],
      env: { jest: true },
    },
  ],
};
