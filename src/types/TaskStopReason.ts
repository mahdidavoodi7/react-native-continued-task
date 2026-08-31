/**
 * Why a {@linkcode ContinuedTask} stopped before the app called
 * {@linkcode ContinuedTask.complete}.
 *
 * This is a normalized reason. It is always delivered alongside the raw
 * platform detail in {@linkcode TaskStopEvent.native} — never map on this
 * value alone when you need to debug a real device.
 *
 * @see {@linkcode TaskStopEvent.reason}
 */
export type TaskStopReason =
  /**
   * The user cancelled the task from the UI the system shows for it —
   * the iOS Live Activity, or the Android notification's cancel action.
   */
  | 'user-cancelled'
  /** The app itself called {@linkcode ContinuedTask.cancel}. */
  | 'app-cancelled'
  /**
   * The system expired the task. On iOS this arrives through the task's
   * expiration handler, and a task that reports no progress will eventually
   * be expired this way. On Android it maps to a generic WorkManager stop.
   */
  | 'expired'
  /**
   * Android 15+ only: the app exhausted the 6-hour-per-24-hours budget for
   * this foreground service type. Maps to WorkManager's
   * `STOP_REASON_FOREGROUND_SERVICE_TIMEOUT`.
   */
  | 'fgs-timeout'
  /**
   * Android 16+ only: the app ran out of JobScheduler quota while a
   * foreground service was running. Maps to WorkManager's
   * `STOP_REASON_QUOTA`.
   */
  | 'quota'
  /**
   * The task was still in flight when the app process last went away, and
   * this is the first time the app has seen it since. iOS gives no callback
   * when the user swipes the app out of the app switcher, so this reason is
   * reconstructed on the next launch and is only ever reported by
   * {@linkcode KnownTask.stopReason}, never by a live listener.
   */
  | 'app-terminated'
  /** The platform reported a stop this library does not have a name for. */
  | 'unknown';
