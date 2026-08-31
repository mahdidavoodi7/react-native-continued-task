/**
 * Only used by React Native Harness, which runs from the repo root.
 *
 * Harness passes its own project root to `Metro.loadConfig`, so without a
 * config here Metro would fall back to its defaults and lose the monorepo
 * resolver and the `react-native-continued-task-source` condition that let the
 * example app import the library from source.
 */
module.exports = require('./example/metro.config.js');
