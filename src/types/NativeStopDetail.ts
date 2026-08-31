/**
 * The unmapped platform detail behind a {@linkcode TaskStopReason}.
 *
 * Always logged and always present, so that a stop this library normalizes to
 * `'unknown'` is still debuggable from a user's crash report.
 *
 * @see {@linkcode TaskStopEvent.native}
 */
export interface NativeStopDetail {
  /**
   * The platform subsystem that reported the stop:
   * `'BGTaskScheduler'` on iOS, `'WorkManager'` on Android.
   */
  domain: string;
  /**
   * The raw platform constant, when there is one. Android reports
   * `WorkInfo.getStopReason()`. iOS expiration carries no code, so this is
   * `undefined` for an iOS expiration.
   */
  code?: number;
  /**
   * The platform's own name for {@linkcode NativeStopDetail.code}, such as
   * `'STOP_REASON_FOREGROUND_SERVICE_TIMEOUT'` or `'expirationHandler'`.
   */
  name: string;
}
