import { NitroModules } from 'react-native-nitro-modules';
import type { ContinuedTask } from './ContinuedTask.nitro';

const ContinuedTaskHybridObject =
  NitroModules.createHybridObject<ContinuedTask>('ContinuedTask');

export function multiply(a: number, b: number): number {
  return ContinuedTaskHybridObject.multiply(a, b);
}
