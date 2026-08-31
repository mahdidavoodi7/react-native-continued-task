import type { ContinuedTaskManager } from './specs/ContinuedTaskManager.nitro';
import { createUnsupportedManager } from './createUnsupportedManager';

/**
 * The web / non-native build of the entry point.
 *
 * There is no browser equivalent of a continued processing task, so this
 * reports {@linkcode ContinuedTaskManager.isSupported} as `false`, keeps
 * {@linkcode ContinuedTaskManager.getKnownTasks} empty, and rejects
 * {@linkcode ContinuedTaskManager.submit} with the `'unsupported-platform'`
 * {@linkcode SubmitErrorCode}. Metro and `react-native-builder-bob` resolve
 * `ContinuedTasks.native.ts` ahead of this file on iOS and Android.
 *
 * @see {@linkcode ContinuedTaskManager}
 */
export const ContinuedTasks: ContinuedTaskManager = createUnsupportedManager();
