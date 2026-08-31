import type { InfoPlist } from '@expo/config-plugins/build/ios/IosConfig.types'
import { PERMITTED_IDENTIFIERS_KEY } from './ContinuedTaskPluginOptions'

/**
 * Writes the wildcard expansion of every prefix into
 * `BGTaskSchedulerPermittedIdentifiers`, preserving entries other plugins or
 * the app itself already added.
 *
 * Prefixes are expanded here rather than at the call site so a caller cannot
 * write a bare identifier that the scheduler will later reject. A prefix
 * already ending in `.*` is passed through unchanged.
 */
export function setPermittedIdentifiers(
  infoPlist: InfoPlist,
  prefixes: string[]
): InfoPlist {
  const existing = Array.isArray(infoPlist[PERMITTED_IDENTIFIERS_KEY])
    ? (infoPlist[PERMITTED_IDENTIFIERS_KEY] as string[])
    : []
  const wildcards = prefixes.map((prefix) =>
    prefix.endsWith('.*') ? prefix : `${prefix}.*`
  )
  return {
    ...infoPlist,
    [PERMITTED_IDENTIFIERS_KEY]: [...new Set([...existing, ...wildcards])],
  }
}
