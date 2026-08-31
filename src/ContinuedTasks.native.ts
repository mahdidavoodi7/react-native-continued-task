import { NitroModules } from 'react-native-nitro-modules';
import type { ContinuedTaskManager } from './specs/ContinuedTaskManager.nitro';

/**
 * The library's entry point: submits continued background work and reconciles
 * work that outlived a previous app process.
 *
 * @see {@linkcode ContinuedTaskManager}
 */
export const ContinuedTasks =
  NitroModules.createHybridObject<ContinuedTaskManager>('ContinuedTaskManager');
