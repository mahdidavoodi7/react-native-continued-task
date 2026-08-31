/**
 * The lifecycle stage of a {@linkcode ContinuedTask}.
 *
 * A task is `pending` between a successful submission and the moment the
 * platform actually starts it. On iOS a task submitted with the
 * {@linkcode IOSTaskOptions.submissionStrategy} `'queue'` can stay `pending`
 * for a while; on Android WorkManager may hold it until its constraints are met.
 *
 * @see {@linkcode ContinuedTask.state}
 */
export type ContinuedTaskState =
  /** Accepted by the platform scheduler, not started yet. */
  | 'pending'
  /** Running now. Progress reports are only meaningful in this state. */
  | 'running'
  /** The app called {@linkcode ContinuedTask.complete}. */
  | 'finished'
  /** The platform or the user stopped the task. See {@linkcode TaskStopEvent}. */
  | 'stopped';
