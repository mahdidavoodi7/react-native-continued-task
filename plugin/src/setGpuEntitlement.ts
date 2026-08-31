import type { JSONObject } from '@expo/json-file';
import { GPU_ENTITLEMENT_KEY } from './ContinuedTaskPluginOptions';

/**
 * Adds or removes the background GPU entitlement.
 *
 * Xcode declares it as a boolean whose only valid value is the constant
 * `true`, so `enableGPU: false` removes the key entirely rather than writing
 * `false`.
 */
export function setGpuEntitlement(
  entitlements: JSONObject,
  enableGPU: boolean
): JSONObject {
  if (enableGPU) {
    return { ...entitlements, [GPU_ENTITLEMENT_KEY]: true };
  }
  const rest = { ...entitlements };
  delete rest[GPU_ENTITLEMENT_KEY];
  return rest;
}
