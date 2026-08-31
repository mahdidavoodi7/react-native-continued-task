import type { ContinuedTask } from './specs/ContinuedTask.nitro';
import type { ContinuedTaskManager } from './specs/ContinuedTaskManager.nitro';
import type { KnownTask } from './types/KnownTask';

const UNSUPPORTED_MESSAGE =
  'continued-task/unsupported-platform: Continued tasks need iOS 26+ or Android. ' +
  'Check ContinuedTasks.isSupported before submitting.';

/**
 * Builds the inert {@linkcode ContinuedTaskManager} used on platforms with no
 * native implementation — the web bundle, and plain Jest.
 *
 * Every capability reads `false` and no method silently succeeds, so app code
 * written against the native API fails in the same shape it would on an
 * unsupported device.
 *
 * @see {@linkcode ContinuedTaskManager.isSupported}
 */
export function createUnsupportedManager(): ContinuedTaskManager {
  const manager = {
    name: 'ContinuedTaskManager',
    isSupported: false,
    supportsGPU: false,
    supportsReattach: false,
    submit: (): Promise<ContinuedTask> =>
      Promise.reject(new Error(UNSUPPORTED_MESSAGE)),
    getKnownTasks: (): Promise<KnownTask[]> => Promise.resolve([]),
    attachToTask: (): Promise<ContinuedTask | undefined> =>
      Promise.resolve(undefined),
    forgetTasks: (): Promise<void> => Promise.resolve(),
    equals: (other: unknown): boolean => other === manager,
    dispose: (): void => undefined,
    toString: (): string => '[HybridObject ContinuedTaskManager (unsupported)]',
  };
  return manager as unknown as ContinuedTaskManager;
}
