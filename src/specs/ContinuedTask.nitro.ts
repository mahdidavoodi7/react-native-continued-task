import type { HybridObject } from 'react-native-nitro-modules';
import type { ContinuedTaskState } from '../types/ContinuedTaskState';
import type { ListenerSubscription } from '../types/ListenerSubscription';
import type { TaskStopEvent } from '../types/TaskStopEvent';

/**
 * A live handle to one piece of continued background work.
 *
 * Returned by {@linkcode ContinuedTaskManager.submit}. The handle owns the
 * native task — the `BGContinuedProcessingTask` on iOS, the WorkManager
 * request on Android — so there are no task identifiers to thread through
 * your own code and no way to address a task that no longer exists.
 *
 * The one rule that matters: **report progress**. iOS expires continued
 * processing tasks that appear stalled, so a task that never calls
 * {@linkcode ContinuedTask.setProgress} will be killed by the system rather
 * than run to completion.
 *
 * @see {@linkcode ContinuedTaskManager.submit}
 */
export interface ContinuedTask extends HybridObject<{
  ios: 'swift';
  android: 'kotlin';
}> {
  /**
   * The concrete task identifier, `'<identifierPrefix>.<uuid>'`. Stable for
   * the life of the task and matches {@linkcode KnownTask.id}.
   */
  readonly id: string;
  /** The title currently shown to the user. */
  readonly title: string;
  /** The subtitle currently shown to the user. */
  readonly subtitle: string;
  /** Where the task is in its lifecycle. */
  readonly state: ContinuedTaskState;
  /** The last completed unit count reported through {@linkcode ContinuedTask.setProgress}. */
  readonly completedUnitCount: number;
  /** The task's current total unit count. */
  readonly totalUnitCount: number;

  /**
   * Replaces both the title and the subtitle shown in the iOS Live Activity
   * or the Android notification.
   *
   * Both values are replaced on every call — iOS has no API for changing one
   * without the other, so pass the current value for the one you are keeping.
   */
  updateTitle(title: string, subtitle: string): void;

  /**
   * Reports how far along the work is.
   *
   * This is the call that keeps the task alive. iOS deprioritizes and then
   * expires continued processing tasks that report no progress, so call this
   * as the work advances rather than once at the end.
   *
   * `completedUnitCount` is clamped to `[0, totalUnitCount]`. Passing a new
   * `totalUnitCount` is allowed for work whose size is only known as it runs.
   */
  setProgress(completedUnitCount: number, totalUnitCount: number): void;

  /**
   * Tells the system the work is done, successfully or not, and releases the
   * task. Calling it a second time is a no-op.
   *
   * Not calling it is a bug: iOS keeps the app running until the task's time
   * runs out, and may kill the app for it.
   */
  complete(success: boolean): void;

  /**
   * Cancels the task from the app side.
   *
   * Listeners receive a {@linkcode TaskStopEvent} with the `'app-cancelled'`
   * reason. Cancelling an already finished task is a no-op.
   */
  cancel(): void;

  /**
   * Called when the task starts running.
   *
   * If the task is already running when the listener is added, it is called
   * once immediately, so there is no race between submitting and subscribing.
   * It is never called for a task that stops while still `'pending'`.
   */
  addOnStartListener(listener: () => void): ListenerSubscription;

  /**
   * Called when the task stops without {@linkcode ContinuedTask.complete}
   * having been called — user cancellation, system expiration, an Android
   * foreground-service timeout or quota exhaustion.
   *
   * This listener does **not** fire when the user swipes the app out of the
   * app switcher on iOS. The system gives the app no indication of that
   * cancellation; use {@linkcode ContinuedTaskManager.getKnownTasks} on the
   * next launch to find work that ended that way.
   */
  addOnStopListener(
    listener: (event: TaskStopEvent) => void
  ): ListenerSubscription;
}
