/**
 * The device QA checklist.
 *
 * `BGContinuedProcessingTask` cannot be exercised in CI or the Simulator, so
 * this list is the only verification the iOS side ever gets. Each entry says
 * why it exists, because a checklist nobody understands gets clicked through.
 */
export type CheckKind =
  /** Runs and verifies itself with one tap. */
  | 'automatic'
  /** Needs the tester to look at something the app cannot see. */
  | 'interactive'
  /** Armed here, verified automatically the next time the app comes back. */
  | 'survives-kill';

export type CheckStatus = 'pending' | 'armed' | 'passed' | 'failed' | 'skipped';

export interface CheckDefinition {
  id: string;
  title: string;
  kind: CheckKind;
  /** Why getting this wrong matters. */
  why: string;
  /** What the tester does. */
  how: string;
  /** What counts as a pass. */
  expect: string;
}

export const CHECKS: CheckDefinition[] = [
  {
    id: 'double-submit',
    title: 'Two submissions in a row',
    kind: 'automatic',
    why: 'Apple: "The system kills the app on the second registration of the same task identifier." If the native registration guard is wrong, this crashes the whole app rather than failing politely.',
    how: 'Tap Run automatic checks.',
    expect: 'Two tasks with different ids, both accepted, app still alive.',
  },
  {
    id: 'progress-clamp',
    title: 'Progress is clamped, not trusted',
    kind: 'automatic',
    why: 'Progress drives the Live Activity. An out-of-range value should be clamped rather than shown to the user or passed to Foundation.Progress raw.',
    how: 'Tap Run automatic checks.',
    expect:
      'setProgress(999, 10) reads back 10; setProgress(-5, 10) reads back 0.',
  },
  {
    id: 'complete-idempotent',
    title: 'complete() twice is a no-op',
    kind: 'automatic',
    why: 'Calling setTaskCompleted twice on a real BGTask is undefined behaviour; the wrapper has to swallow the second call.',
    how: 'Tap Run automatic checks.',
    expect: 'State stays "finished", no crash.',
  },
  {
    id: 'app-cancel',
    title: 'Cancelling from the app reports app-cancelled',
    kind: 'automatic',
    why: 'Your own cancellation must be distinguishable from the system killing the task, or you cannot tell a bug from a user action.',
    how: 'Tap Run automatic checks.',
    expect: 'A stop event with reason "app-cancelled".',
  },
  {
    id: 'unpermitted-identifier',
    title: 'Undeclared identifier is refused cleanly',
    kind: 'automatic',
    why: 'An identifier missing from BGTaskSchedulerPermittedIdentifiers is the most common setup mistake. It must surface as a typed error, never a crash.',
    how: 'Tap Run automatic checks.',
    expect: 'submit() rejects with code "not-permitted".',
  },
  {
    id: 'invalid-options',
    title: 'Zero totalUnitCount is refused',
    kind: 'automatic',
    why: 'Progress reporting is what keeps a task alive, so a task with nothing to report is a bug worth catching at the call site.',
    how: 'Tap Run automatic checks.',
    expect: 'submit() rejects with code "invalid-options".',
  },
  {
    id: 'gpu-gate',
    title: 'GPU request matches what the device reports',
    kind: 'automatic',
    why: 'Requesting an unavailable or unentitled resource fails submission with .notPermitted. The capability flag and the actual behaviour must agree.',
    how: 'Tap Run automatic checks.',
    expect:
      'If supportsGPU is true and the entitlement is present, a GPU task is accepted. Otherwise submit() rejects with "not-permitted".',
  },
  {
    id: 'records',
    title: 'Tasks are recorded, then forgettable',
    kind: 'automatic',
    why: 'The persisted records are the only way to reconcile work lost to an app-switcher swipe. If they are not written, the reconciliation path is dead.',
    how: 'Tap Run automatic checks.',
    expect:
      'A submitted task appears in getKnownTasks(), and forgetTasks() removes it.',
  },
  {
    id: 'live-activity-visible',
    title: 'The Live Activity shows your title and progress',
    kind: 'interactive',
    why: 'The system provides this UI — the library does not build it. If title, subtitle or progress are not wired to the real BGContinuedProcessingTask, the user sees a blank or stalled activity.',
    how: 'Tap Start, then swipe up to the Home Screen and look at the Dynamic Island / Lock Screen.',
    expect:
      'A system activity titled "QA export" with a subtitle counting up and a progress bar advancing.',
  },
  {
    id: 'title-update',
    title: 'updateTitle changes the Live Activity live',
    kind: 'interactive',
    why: 'iOS has no API to change title or subtitle independently; both must be passed every time. A wrong call here silently stops updating.',
    how: 'While the task from the previous check is running, watch the subtitle.',
    expect: 'The subtitle changes as work progresses, not just at the start.',
  },
  {
    id: 'live-activity-cancel',
    title: 'Cancelling from the Live Activity stops the task',
    kind: 'survives-kill',
    why: 'This is the user\'s only way to stop the work. Note iOS routes it through the same expirationHandler as a system expiry, so the library reports "expired" — it genuinely cannot tell them apart.',
    how: 'Tap Arm, background the app, then cancel from the Live Activity. Return to the app.',
    expect: 'The task ends with stop reason "expired".',
  },
  {
    id: 'stalled-expires',
    title: 'A task that reports no progress gets expired',
    kind: 'survives-kill',
    why: 'Apple: "Tasks that do not report any progress will be expired." This is the behaviour the whole API is shaped around — if it does not happen, the progress contract is not real.',
    how: 'Tap Arm, background the app, and leave it for a few minutes. Return to the app.',
    expect: 'The task ends with stop reason "expired".',
  },
  {
    id: 'app-terminated',
    title: 'Work lost to an app-switcher swipe is reconciled',
    kind: 'survives-kill',
    why: 'Apple: "the app doesn\'t receive an indication of cancellation in that case." No callback, no expiration handler. Reading the records on next launch is the only way to find this work — and it cannot be automated.',
    how: 'Tap Arm, then swipe the app out of the app switcher. Launch it again.',
    expect:
      'On next launch the task is reported with stop reason "app-terminated", and no stop listener ever fired.',
  },
];
