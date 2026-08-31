import type { HybridObject } from 'react-native-nitro-modules';
import type { ContinuedTaskOptions } from '../types/ContinuedTaskOptions';
import type { KnownTask } from '../types/KnownTask';
import type { ContinuedTask } from './ContinuedTask.nitro';

/**
 * Submits and reconciles continued background work.
 *
 * This is the entry point of the library; the app-facing value is exported as
 * `ContinuedTasks`. It wraps `BGContinuedProcessingTask` on iOS 26+ and a
 * WorkManager `CoroutineWorker` running as a foreground service on Android.
 *
 * @see {@linkcode ContinuedTaskManager.submit}
 * @see {@linkcode ContinuedTaskManager.getKnownTasks}
 */
export interface ContinuedTaskManager extends HybridObject<{
  ios: 'swift';
  android: 'kotlin';
}> {
  /**
   * Whether this device can run continued tasks at all: iOS 26 or newer, or
   * Android with the foreground-service permissions granted.
   *
   * `false` on the iOS Simulator, which has no background task scheduler.
   */
  readonly isSupported: boolean;
  /**
   * Whether the device can grant background GPU access, from
   * `BGTaskScheduler.supportedResources`.
   *
   * Check this before setting {@linkcode IOSTaskOptions.requiresGPU}:
   * requesting a resource the device does not support makes
   * {@linkcode ContinuedTaskManager.submit} reject with `'not-permitted'`.
   * Always `false` on Android.
   */
  readonly supportsGPU: boolean;
  /**
   * Whether {@linkcode ContinuedTaskManager.attachToTask} can return a live
   * handle for work started by a previous process.
   *
   * `true` on Android, where a WorkManager worker outlives the app process.
   * `false` on iOS, where the system cancels continued processing tasks when
   * the app is terminated.
   */
  readonly supportsReattach: boolean;

  /**
   * Submits a new task and resolves once the platform scheduler has accepted
   * it. The resolved {@linkcode ContinuedTask} starts in the `'pending'`
   * state; subscribe with {@linkcode ContinuedTask.addOnStartListener} to
   * learn when it is actually running.
   *
   * **Call this from the foreground, in response to something the user did.**
   * iOS requires that a continued processing task be submitted as a result of
   * a person's action, such as tapping a button; submitting from a timer or
   * from the background gets the task cancelled.
   *
   * Rejects with an `Error` whose message is prefixed with a stable
   * `SubmitErrorCode` — read it with `getSubmitErrorCode(error)` rather than
   * matching on the message text.
   */
  submit(options: ContinuedTaskOptions): Promise<ContinuedTask>;

  /**
   * Returns every task this app has submitted that the library still has a
   * record of, newest first.
   *
   * Call this on launch to reconcile. A record whose
   * {@linkcode KnownTask.state} is still `'pending'` or `'running'` but whose
   * {@linkcode KnownTask.stopReason} is `'app-terminated'` was in flight when
   * the process went away — on iOS that is what a swipe out of the app
   * switcher looks like, because the system reports it no other way.
   *
   * Records stay until {@linkcode ContinuedTaskManager.forgetTasks} drops
   * them, so the app decides when it has finished reconciling.
   */
  getKnownTasks(): Promise<KnownTask[]>;

  /**
   * Re-attaches to a task that is still running natively after the app
   * process restarted, so it can be observed, updated or cancelled again.
   *
   * Resolves to `undefined` when there is nothing live to attach to — which
   * is always the case on iOS, where a terminated app's continued processing
   * tasks are gone. Gate on
   * {@linkcode ContinuedTaskManager.supportsReattach}.
   */
  attachToTask(id: string): Promise<ContinuedTask | undefined>;

  /**
   * Drops the persisted records for the given task ids, after the app has
   * reconciled them. Unknown ids are ignored.
   */
  forgetTasks(ids: string[]): Promise<void>;
}
