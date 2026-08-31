import type { ContinuedTaskState } from './ContinuedTaskState';
import type { TaskStopReason } from './TaskStopReason';

/**
 * A persisted record of a task this app submitted, readable across app
 * launches.
 *
 * These records exist because iOS gives the app no indication at all when the
 * user swipes it out of the app switcher — the task is cancelled and no
 * callback runs. Reading the records on the next launch is the only way to
 * find work that was in flight when the process went away.
 *
 * @see {@linkcode ContinuedTaskManager.getKnownTasks}
 */
export interface KnownTask {
  /** The concrete task identifier, `'<identifierPrefix>.<uuid>'`. */
  id: string;
  /** The {@linkcode ContinuedTaskOptions.identifierPrefix} it was submitted under. */
  identifierPrefix: string;
  /** The title as of the last {@linkcode ContinuedTask.updateTitle}. */
  title: string;
  /** The subtitle as of the last {@linkcode ContinuedTask.updateTitle}. */
  subtitle: string;
  /** When the task was submitted, in milliseconds since the Unix epoch. */
  submittedAt: number;
  /**
   * The last state the record saw.
   *
   * A record still marked `'running'` or `'pending'` from a *previous* process
   * is exactly the orphan case: it carries the `'app-terminated'`
   * {@linkcode KnownTask.stopReason}.
   */
  state: ContinuedTaskState;
  /** The last value passed to {@linkcode ContinuedTask.setProgress}. */
  completedUnitCount: number;
  /** The task's total unit count, as last reported. */
  totalUnitCount: number;
  /**
   * Why the task stopped, when it stopped for a reason the library knows.
   * `undefined` while the task is still live in this process.
   */
  stopReason?: TaskStopReason;
}
