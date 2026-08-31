/**
 * Plain-Jest coverage for everything that does not need a native runtime:
 * the config plugin's mods, the submit-error parser, and the
 * unsupported-platform manager.
 *
 * `react-native-nitro-modules` ships no Jest mock and its HybridObjects cannot
 * be instantiated here, so `src/index.ts` (not `index.native.ts`) is what these
 * tests import — the same file the web bundle gets. The native surface is
 * covered by React Native Harness on a device instead.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/plugin/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    'plugin/src/**/*.ts',
    '!**/*.nitro.ts',
    '!**/__tests__/**',
  ],
};
