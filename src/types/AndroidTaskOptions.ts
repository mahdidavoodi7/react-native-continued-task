/**
 * The `foregroundServiceType` the worker's notification runs under.
 *
 * The type you pick has to be declared in the merged
 * `androidx.work.impl.foreground.SystemForegroundService` manifest entry and
 * backed by the matching runtime permission — both of which the bundled Expo
 * config plugin writes for you.
 *
 * @see {@linkcode AndroidTaskOptions.foregroundServiceType}
 */
export type AndroidForegroundServiceType =
  /**
   * `FOREGROUND_SERVICE_TYPE_DATA_SYNC`. The default, and the closest match
   * for upload/download/export work.
   *
   * On Android 15+ every `dataSync` service in the app shares a budget of
   * 6 hours per 24-hour period. At the limit the system stops the task with
   * the `'fgs-timeout'` {@linkcode TaskStopReason}.
   */
  | 'dataSync'
  /** `FOREGROUND_SERVICE_TYPE_MEDIA_PROCESSING`. Transcoding and similar. */
  | 'mediaProcessing'
  /** `FOREGROUND_SERVICE_TYPE_SPECIAL_USE`. Needs a Play Console declaration. */
  | 'specialUse';

/**
 * Android-only settings for {@linkcode ContinuedTaskOptions}.
 *
 * Every field is ignored on iOS. Android has no system-provided Live Activity,
 * so these describe the ongoing notification that stands in for it.
 */
export interface AndroidTaskOptions {
  /**
   * The notification channel to post the ongoing notification on. The library
   * creates the channel if it does not exist yet.
   *
   * @default 'continued-task'
   */
  notificationChannelId?: string;
  /**
   * The user-visible channel name, used only when the library has to create
   * the channel.
   *
   * @default 'Background tasks'
   */
  notificationChannelName?: string;
  /**
   * The drawable resource name for the notification's small icon, such as
   * `'ic_notification'`. Falls back to the app icon when the name does not
   * resolve.
   */
  notificationIcon?: string;
  /**
   * Show a cancel action on the notification, wired to WorkManager's
   * `createCancelPendingIntent`. This is the Android counterpart of cancelling
   * from the iOS Live Activity and reports the `'user-cancelled'`
   * {@linkcode TaskStopReason}.
   *
   * @default true
   */
  showCancelAction?: boolean;
  /**
   * The label on that cancel action.
   *
   * @default 'Cancel'
   */
  cancelActionLabel?: string;
  /**
   * Which foreground service type to run under.
   *
   * @default 'dataSync'
   */
  foregroundServiceType?: AndroidForegroundServiceType;
}
