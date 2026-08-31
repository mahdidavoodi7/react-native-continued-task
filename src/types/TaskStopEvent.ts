import type { NativeStopDetail } from './NativeStopDetail';
import type { TaskStopReason } from './TaskStopReason';

/**
 * Delivered when a {@linkcode ContinuedTask} stops without the app calling
 * {@linkcode ContinuedTask.complete}.
 *
 * @see {@linkcode ContinuedTask.addOnStopListener}
 */
export interface TaskStopEvent {
  /** The {@linkcode ContinuedTask.id} of the task that stopped. */
  taskId: string;
  /** The normalized reason. */
  reason: TaskStopReason;
  /** The raw platform detail behind {@linkcode TaskStopEvent.reason}. */
  native: NativeStopDetail;
}
