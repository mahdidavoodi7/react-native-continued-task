import type { SubmitErrorCode } from '../types/SubmitErrorCode';

const KNOWN_CODES: readonly SubmitErrorCode[] = [
  'not-permitted',
  'too-many-pending-requests',
  'unavailable',
  'immediate-run-ineligible',
  'unsupported-platform',
  'invalid-identifier',
  'invalid-options',
  'foreground-service-unavailable',
  'unknown',
];

/**
 * Reads the {@linkcode SubmitErrorCode} out of an error rejected by
 * {@linkcode ContinuedTaskManager.submit}.
 *
 * Native code formats those messages as `'continued-task/<code>: <message>'`.
 * Anything else — including errors from elsewhere — reads as `'unknown'`.
 *
 * @example
 * ```ts
 * try {
 *   await ContinuedTasks.submit(options)
 * } catch (error) {
 *   if (getSubmitErrorCode(error) === 'too-many-pending-requests') {
 *     // ...
 *   }
 * }
 * ```
 */
export function getSubmitErrorCode(error: unknown): SubmitErrorCode {
  if (!(error instanceof Error)) {
    return 'unknown';
  }
  const match = /^continued-task\/([a-z-]+)/.exec(error.message);
  if (match === null) {
    return 'unknown';
  }
  const code = match[1] as SubmitErrorCode;
  return KNOWN_CODES.includes(code) ? code : 'unknown';
}
