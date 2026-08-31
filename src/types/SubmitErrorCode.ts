/**
 * The stable code prefixing the message of every error
 * {@linkcode ContinuedTaskManager.submit} rejects with.
 *
 * Read it with `getSubmitErrorCode(error)`; the four `BGTaskScheduler.Error`
 * cases are kept distinct on purpose, because they call for different fixes.
 */
export type SubmitErrorCode =
  /**
   * iOS `BGTaskScheduler.Error.Code.notPermitted` (3). The identifier is not
   * covered by `BGTaskSchedulerPermittedIdentifiers`, the requested GPU
   * resource is unavailable or unentitled, or the user has denied the app
   * background launches.
   */
  | 'not-permitted'
  /** iOS `.tooManyPendingTaskRequests` (2). Cancel some pending work and retry. */
  | 'too-many-pending-requests'
  /**
   * iOS `.unavailable` (1). Background refresh is off in Settings, or the app
   * is running in the Simulator, which has no background task scheduler.
   */
  | 'unavailable'
  /**
   * iOS `.immediateRunIneligible` (4). Only ever returned for a submission
   * made with the `'fail'` {@linkcode SubmissionStrategy}.
   */
  | 'immediate-run-ineligible'
  /**
   * The platform cannot run continued tasks: iOS older than 26, or the web.
   * {@linkcode ContinuedTaskManager.isSupported} is `false`.
   */
  | 'unsupported-platform'
  /**
   * The {@linkcode ContinuedTaskOptions.identifierPrefix} is malformed — empty,
   * already ending in `.*`, or not prefixed with the app's bundle identifier.
   */
  | 'invalid-identifier'
  /** {@linkcode ContinuedTaskOptions} failed validation before reaching the platform. */
  | 'invalid-options'
  /** Android could not start the foreground service, usually a missing permission. */
  | 'foreground-service-unavailable'
  /** Something the library does not have a code for. Read the message. */
  | 'unknown';
