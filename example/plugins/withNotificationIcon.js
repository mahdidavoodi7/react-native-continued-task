const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod } = require('@expo/config-plugins');

const DENSITIES = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];

/**
 * Installs `ic_notification` into the Android resources.
 *
 * Without it the library falls back to the launcher icon, and Android renders
 * a notification small icon as an alpha-only silhouette — so a launcher icon
 * that is a filled circle shows up as a featureless dot. Notification icons
 * have to be white-on-transparent artwork of their own.
 *
 * Done as a plugin rather than by editing `android/` directly so it survives
 * `expo prebuild --clean`.
 */
module.exports = function withNotificationIcon(config) {
  return withDangerousMod(config, [
    'android',
    (dangerousConfig) => {
      const source = path.join(
        dangerousConfig.modRequest.projectRoot,
        'assets',
        'notification-icon'
      );
      const resources = path.join(
        dangerousConfig.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res'
      );

      for (const density of DENSITIES) {
        const from = path.join(source, `${density}.png`);
        if (!fs.existsSync(from)) continue;
        const directory = path.join(resources, `drawable-${density}`);
        fs.mkdirSync(directory, { recursive: true });
        fs.copyFileSync(from, path.join(directory, 'ic_notification.png'));
      }

      return dangerousConfig;
    },
  ]);
};
