import { PermissionsAndroid, Platform } from 'react-native';

/**
 * Asks for POST_NOTIFICATIONS on Android 13+.
 *
 * Declaring the permission in the manifest is not enough: without a runtime
 * grant the foreground service still starts and the work still runs, but its
 * notification is silently suppressed, so the task looks like it did nothing.
 * The library cannot ask on the app's behalf — a permission prompt needs an
 * Activity — so the app has to.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (typeof Platform.Version === 'number' && Platform.Version < 33)
    return true;

  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  if (await PermissionsAndroid.check(permission)) return true;

  const result = await PermissionsAndroid.request(permission);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}
