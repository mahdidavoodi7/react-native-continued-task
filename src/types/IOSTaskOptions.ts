/**
 * How the iOS scheduler should treat a submission that it cannot start
 * straight away.
 *
 * @see {@linkcode IOSTaskOptions.submissionStrategy}
 */
export type SubmissionStrategy =
  /**
   * Queue the request behind other work and start it when there is room.
   * This is the platform default.
   *
   * A queued request is cancelled — silently, with no callback — when the
   * user swipes the app out of the app switcher.
   */
  | 'queue'
  /**
   * Fail the submission outright when the system cannot start the task
   * immediately. `submit` then rejects with the
   * `'immediate-run-ineligible'` {@linkcode SubmitErrorCode}, which is the
   * only strategy under which that code can occur.
   */
  | 'fail';

/**
 * iOS-only settings for {@linkcode ContinuedTaskOptions}.
 *
 * Every field is ignored on Android.
 */
export interface IOSTaskOptions {
  /**
   * How to handle a submission the system cannot start immediately.
   *
   * @default 'queue'
   */
  submissionStrategy?: SubmissionStrategy;
  /**
   * Ask the scheduler for background GPU access.
   *
   * Requires the `com.apple.developer.background-tasks.continued-processing.gpu`
   * entitlement (Xcode capability "Background GPU Access"), which the bundled
   * Expo config plugin adds when you set its `enableGPU` option. It also
   * requires hardware support — check
   * {@linkcode ContinuedTaskManager.supportsGPU} first. Requesting the GPU
   * where it is unavailable makes `submit` reject with `'not-permitted'`.
   *
   * @default false
   */
  requiresGPU?: boolean;
}
