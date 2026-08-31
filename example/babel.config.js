const path = require('path');
const { getConfig } = require('react-native-builder-bob/babel-config');
const pkg = require('../package.json');

const root = path.resolve(__dirname, '..');

module.exports = function (api) {
  api.cache(true);

  return getConfig(
    {
      // The harness preset is what installs `describe`/`it`/`expect` into the
      // test bundles it serves. It is inert outside a harness run.
      presets: ['babel-preset-expo', 'react-native-harness/babel-preset'],
    },
    { root, pkg }
  );
};
