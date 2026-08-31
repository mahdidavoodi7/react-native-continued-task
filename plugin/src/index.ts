import type { ConfigPlugin } from '@expo/config-plugins'
import {
  createRunOncePlugin,
  withAndroidManifest,
  withEntitlementsPlist,
  withInfoPlist,
} from '@expo/config-plugins'
import { addForegroundServiceConfig } from './addForegroundServiceConfig'
import type { ContinuedTaskPluginOptions } from './ContinuedTaskPluginOptions'
import { setGpuEntitlement } from './setGpuEntitlement'
import { setPermittedIdentifiers } from './setPermittedIdentifiers'

const pkg = require('../../package.json') as { name: string; version: string }

const withContinuedTask: ConfigPlugin<ContinuedTaskPluginOptions | void> = (
  config,
  options
) => {
  const {
    identifierPrefixes = [],
    enableGPU = false,
    androidForegroundServiceTypes = ['dataSync' as const],
  } = options ?? {}

  // No UIBackgroundModes value is written. BGProcessingTask documents that it
  // needs `processing` and BGAppRefreshTask that it needs `fetch`;
  // BGContinuedProcessingTask's header carries no such requirement, and Xcode
  // declares no UIBackgroundModes-backed capability for it.
  config = withInfoPlist(config, (infoPlistConfig) => {
    infoPlistConfig.modResults = setPermittedIdentifiers(
      infoPlistConfig.modResults,
      identifierPrefixes
    )
    return infoPlistConfig
  })

  config = withEntitlementsPlist(config, (entitlementsConfig) => {
    entitlementsConfig.modResults = setGpuEntitlement(
      entitlementsConfig.modResults,
      enableGPU
    )
    return entitlementsConfig
  })

  config = withAndroidManifest(config, (manifestConfig) => {
    manifestConfig.modResults = addForegroundServiceConfig(
      manifestConfig.modResults,
      androidForegroundServiceTypes
    )
    return manifestConfig
  })

  return config
}

export { addForegroundServiceConfig } from './addForegroundServiceConfig'
export type {
  AndroidForegroundServiceTypeOption,
  ContinuedTaskPluginOptions,
} from './ContinuedTaskPluginOptions'
export { setGpuEntitlement } from './setGpuEntitlement'
export { setPermittedIdentifiers } from './setPermittedIdentifiers'
export default createRunOncePlugin(withContinuedTask, pkg.name, pkg.version)
