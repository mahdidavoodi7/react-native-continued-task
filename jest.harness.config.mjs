import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The harness runner is what `react-native-harness/jest-preset` sets; it is
 * inlined here because Jest's `preset` resolver looks for a literal
 * `jest-preset.js` at the package root and this package exposes it only
 * through an `exports` subpath.
 *
 * `rootDir` is the repo root, not `example/`. Harness passes Jest's `rootDir`
 * to `Metro.loadConfig` as the project root and resolves both the entry point
 * and every test file against it, so the harness entry, the tests and
 * `metro.config.js` all live here.
 */
export default {
  runner: '@react-native-harness/jest',
  rootDir: dirname(fileURLToPath(import.meta.url)),
  testMatch: ['<rootDir>/harness/**/*.test.ts'],
};
