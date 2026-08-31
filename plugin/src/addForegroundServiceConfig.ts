import { AndroidConfig } from '@expo/config-plugins';
import type { AndroidManifest } from '@expo/config-plugins/build/android/Manifest';
import type { AndroidForegroundServiceTypeOption } from './ContinuedTaskPluginOptions';
import {
  FOREGROUND_SERVICE_PERMISSIONS,
  WORK_MANAGER_SERVICE,
} from './ContinuedTaskPluginOptions';

/**
 * Declares the permissions and the merged `SystemForegroundService` entry the
 * worker needs.
 *
 * WorkManager's own manifest declares `SystemForegroundService` but not a
 * `foregroundServiceType`, and Android refuses to start a typed foreground
 * service without one. `tools:node="merge"` layers the attribute onto
 * WorkManager's declaration instead of colliding with it, which is why the
 * `tools` namespace has to exist on the manifest root.
 */
export function addForegroundServiceConfig(
  androidManifest: AndroidManifest,
  types: AndroidForegroundServiceTypeOption[]
): AndroidManifest {
  AndroidConfig.Manifest.ensureToolsAvailable(androidManifest);

  const permissions = [
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.POST_NOTIFICATIONS',
    ...types.map((type) => FOREGROUND_SERVICE_PERMISSIONS[type]),
  ];
  for (const permission of permissions) {
    AndroidConfig.Permissions.ensurePermission(androidManifest, permission);
  }

  const application = androidManifest.manifest.application?.[0];
  if (application === undefined) {
    return androidManifest;
  }

  const services = application.service ?? [];
  const merged = {
    $: {
      'android:name': WORK_MANAGER_SERVICE,
      'android:foregroundServiceType': types.join('|'),
      'tools:node': 'merge',
    },
  };
  application.service = [
    ...services.filter(
      (service) => service.$?.['android:name'] !== WORK_MANAGER_SERVICE
    ),
    merged as (typeof services)[number],
  ];

  return androidManifest;
}
