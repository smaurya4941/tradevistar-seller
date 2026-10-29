/**
 * Two projects: the app runs under the React Native preset with native modules mocked; the shared
 * API package runs under plain Node, because it must not depend on anything React Native adds.
 */
module.exports = {
  // The first render in a file pays for transforming the React Native tree.
  testTimeout: 30000,
  projects: [
    {
      displayName: 'app',
      preset: '@react-native/jest-preset',
      roots: ['<rootDir>/src'],
      setupFiles: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@tradevistar/seller-api$':
          '<rootDir>/packages/seller-api/src/index.ts',
      },
      transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|@react-native-firebase|@shopify/flash-list|@d11/react-native-fast-image|react-native-.*)/)',
      ],
    },
    {
      displayName: 'seller-api',
      testEnvironment: 'node',
      roots: ['<rootDir>/packages/seller-api/src'],
      transform: { '\\.[jt]sx?$': 'babel-jest' },
    },
  ],
};
