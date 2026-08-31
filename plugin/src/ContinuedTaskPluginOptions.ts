/** The `foregroundServiceType` values the Android worker can run under. */
export type AndroidForegroundServiceTypeOption =
  | 'dataSync'
  | 'mediaProcessing'
  | 'specialUse'

/** Options accepted by the `react-native-continued-task` Expo config plugin. */
export interface ContinuedTaskPluginOptions {
  /**
   * The identifier prefixes this app submits tasks under, written **without**
   * their trailing `.*` — for example `'com.foo.MyApp.export'`.
   *
   * Each is expanded to `'<prefix>.*'` in `BGTaskSchedulerPermittedIdentifiers`.
   * An identifier the app submits that is not covered by this array makes
   * `submit` reject with `not-permitted`.
   */
  identifierPrefixes?: string[]
  /**
   * Add the `com.apple.developer.background-tasks.continued-processing.gpu`
   * entitlement, the Xcode "Background GPU Access" capability.
   *
   * Only needed for tasks submitted with `ios.requiresGPU`. Non-GPU work needs
   * no entitlement.
   *
   * @default false
   */
  enableGPU?: boolean
  /**
   * Which foreground service types to declare on Android.
   *
   * @default ['dataSync']
   */
  androidForegroundServiceTypes?: AndroidForegroundServiceTypeOption[]
}

/** The iOS `Info.plist` key holding the permitted identifiers. */
export const PERMITTED_IDENTIFIERS_KEY = 'BGTaskSchedulerPermittedIdentifiers'

/** The iOS entitlement gating background GPU access. */
export const GPU_ENTITLEMENT_KEY =
  'com.apple.developer.background-tasks.continued-processing.gpu'

/** The WorkManager service whose `foregroundServiceType` has to be merged in. */
export const WORK_MANAGER_SERVICE =
  'androidx.work.impl.foreground.SystemForegroundService'

/** The runtime permission each foreground service type requires. */
export const FOREGROUND_SERVICE_PERMISSIONS: Record<
  AndroidForegroundServiceTypeOption,
  string
> = {
  dataSync: 'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
  mediaProcessing: 'android.permission.FOREGROUND_SERVICE_MEDIA_PROCESSING',
  specialUse: 'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
}
