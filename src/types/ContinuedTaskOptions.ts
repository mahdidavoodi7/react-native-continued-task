import type { AndroidTaskOptions } from './AndroidTaskOptions';
import type { IOSTaskOptions } from './IOSTaskOptions';

/**
 * Everything needed to submit one unit of continued background work.
 *
 * @see {@linkcode ContinuedTaskManager.submit}
 */
export interface ContinuedTaskOptions {
  /**
   * The wildcard identifier prefix this task belongs to, written **without**
   * the trailing `.*` — for example `'com.foo.MyApp.export'`.
   *
   * On iOS the prefix must start with the app's bundle identifier and the
   * wildcard form `'<prefix>.*'` must appear in the app's
   * `BGTaskSchedulerPermittedIdentifiers`; the bundled Expo config plugin
   * writes that array from its `identifierPrefixes` option. The library
   * appends a fresh UUID to build the concrete identifier it registers and
   * submits, which is what lets several tasks of the same kind run at once.
   *
   * On Android the prefix is used as the WorkManager tag, so
   * {@linkcode ContinuedTaskManager.getKnownTasks} can group records the same
   * way on both platforms.
   */
  identifierPrefix: string;
  /**
   * The localized title the system shows the user — in the iOS Live Activity,
   * or the Android notification.
   *
   * Can be changed later with {@linkcode ContinuedTask.updateTitle}.
   */
  title: string;
  /**
   * The localized subtitle shown under {@linkcode ContinuedTaskOptions.title}.
   *
   * Can be changed later with {@linkcode ContinuedTask.updateTitle}.
   */
  subtitle: string;
  /**
   * The size of the work, in whatever unit suits it — bytes, files, frames.
   *
   * This is required because progress reporting is not decoration. iOS expires
   * continued processing tasks that report no progress, so the task starts at
   * `0` of this total and the app is expected to call
   * {@linkcode ContinuedTask.setProgress} as it goes.
   */
  totalUnitCount: number;
  /** iOS-only settings. Ignored on Android. */
  ios?: IOSTaskOptions;
  /** Android-only settings. Ignored on iOS. */
  android?: AndroidTaskOptions;
}
