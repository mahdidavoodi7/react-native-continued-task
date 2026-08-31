# react-native-continued-task

Run user-initiated work that keeps going after the user leaves your app — a large export, an upload, a batch encode — behind one cross-platform API.

| Platform            | Backed by                                                           |
| ------------------- | ------------------------------------------------------------------- |
| iOS 26+             | `BGContinuedProcessingTask`, with the system-provided Live Activity |
| Android (minSdk 24) | WorkManager `CoroutineWorker` running as a foreground service       |

This is not a general "run some code in the background" library. Both platforms only grant this kind of runtime to work the **user just asked for**, both show the user UI they can cancel from, and both will kill work that looks stalled. The API is shaped around those constraints rather than hiding them.

> **Requires a dev build.** Nitro modules never work in Expo Go.

## Installation

```sh
npm install react-native-continued-task react-native-nitro-modules
```

`react-native-nitro-modules` is an _optional_ peer dependency, so npm and yarn resolve the single copy your app already has instead of nesting a second one. A nested second copy crashes at startup with `Nitro was installed twice`.

### Expo

Add the config plugin and declare the identifier prefixes your app will submit under:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-continued-task",
        {
          "identifierPrefixes": ["com.foo.MyApp.export"],
          "enableGPU": false
        }
      ]
    ]
  }
}
```

Then `npx expo prebuild`. The plugin writes `BGTaskSchedulerPermittedIdentifiers` on iOS (expanding each prefix to `<prefix>.*`), the GPU entitlement when `enableGPU` is set, and on Android the foreground-service permissions plus the merged `SystemForegroundService` block. See [Config plugin](#config-plugin) for the full option list and the bare-workflow equivalents.

## Quick start

```ts
import {
  ContinuedTasks,
  getSubmitErrorCode,
} from 'react-native-continued-task';

async function exportLibrary(photos: Photo[]) {
  if (!ContinuedTasks.isSupported) return exportInForeground(photos);

  // Must be called from the foreground, in response to a user action.
  const task = await ContinuedTasks.submit({
    identifierPrefix: 'com.foo.MyApp.export',
    title: 'Exporting library',
    subtitle: `0 of ${photos.length} photos`,
    totalUnitCount: photos.length,
  });

  task.addOnStopListener(({ reason, native }) => {
    console.log(`export stopped: ${reason} (${native.domain} ${native.name})`);
    // The task is already gone. Save whatever partial state you have.
  });

  try {
    for (const [index, photo] of photos.entries()) {
      await exportOne(photo);
      // Report progress. This is what keeps the task alive.
      task.setProgress(index + 1, photos.length);
      task.updateTitle(
        'Exporting library',
        `${index + 1} of ${photos.length} photos`
      );
    }
    task.complete(true);
  } catch (error) {
    task.complete(false);
  }
}
```

## API

### `ContinuedTasks`

The entry point. A `ContinuedTaskManager`.

#### `isSupported: boolean`

`true` on iOS 26+ and on Android once the foreground-service permissions are granted. `false` on the iOS Simulator, which has no background task scheduler, and on web.

#### `supportsGPU: boolean`

Reads `BGTaskScheduler.supportedResources` — whether _this device_ can grant background GPU access. Always `false` on Android. Check it before setting `ios.requiresGPU`; asking for a resource the device cannot provide makes `submit` reject with `not-permitted`.

#### `supportsReattach: boolean`

`true` on Android, where a WorkManager worker outlives the app process and `attachToTask` can hand you a live handle again. `false` on iOS, where the system cancels continued processing tasks when the app is terminated.

#### `submit(options: ContinuedTaskOptions): Promise<ContinuedTask>`

Submits a task and resolves once the platform scheduler accepts it. The returned task starts in the `pending` state.

**Call this from the foreground, in direct response to a user action.** iOS requires that submission "occur as a result of a person's action, such as tapping a button"; tasks submitted from a timer, from a push handler, or from the background get cancelled.

Rejects with an `Error` whose message is prefixed with a stable code. Read it with `getSubmitErrorCode(error)` instead of matching on the message:

| `SubmitErrorCode`                | Cause                                                                                                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `not-permitted`                  | `BGTaskScheduler.Error.notPermitted` — identifier missing from `BGTaskSchedulerPermittedIdentifiers`, unentitled or unavailable GPU, or the user denied background launches |
| `too-many-pending-requests`      | `.tooManyPendingTaskRequests` — cancel pending work and retry                                                                                                               |
| `unavailable`                    | `.unavailable` — background refresh off in Settings, or running in the Simulator                                                                                            |
| `immediate-run-ineligible`       | `.immediateRunIneligible` — only ever with the `fail` submission strategy                                                                                                   |
| `unsupported-platform`           | iOS older than 26, or web                                                                                                                                                   |
| `invalid-identifier`             | The prefix is empty, already ends in `.*`, or is not prefixed with the bundle ID                                                                                            |
| `invalid-options`                | Options failed validation before reaching the platform                                                                                                                      |
| `foreground-service-unavailable` | Android could not start the foreground service                                                                                                                              |
| `unknown`                        | Anything else — read the message                                                                                                                                            |

The four `BGTaskScheduler` cases are kept distinct on purpose; they call for different fixes.

##### `ContinuedTaskOptions`

| Field                             | Type                                              | Default              | Notes                                                                                                                                                                                                                     |
| --------------------------------- | ------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `identifierPrefix`                | `string`                                          | —                    | Written **without** the trailing `.*`, e.g. `com.foo.MyApp.export`. Must start with the bundle ID on iOS and be listed in the plugin's `identifierPrefixes`. The library appends a UUID to build the concrete identifier. |
| `title`                           | `string`                                          | —                    | Shown in the Live Activity / notification                                                                                                                                                                                 |
| `subtitle`                        | `string`                                          | —                    | Shown under the title                                                                                                                                                                                                     |
| `totalUnitCount`                  | `number`                                          | —                    | The size of the work, in any unit. Required, because progress is mandatory                                                                                                                                                |
| `ios.submissionStrategy`          | `'queue' \| 'fail'`                               | `'queue'`            | `fail` rejects with `immediate-run-ineligible` rather than waiting                                                                                                                                                        |
| `ios.requiresGPU`                 | `boolean`                                         | `false`              | Needs the GPU entitlement _and_ `supportsGPU`                                                                                                                                                                             |
| `android.notificationChannelId`   | `string`                                          | `'continued-task'`   | Created if absent                                                                                                                                                                                                         |
| `android.notificationChannelName` | `string`                                          | `'Background tasks'` | Only used when creating the channel                                                                                                                                                                                       |
| `android.notificationIcon`        | `string`                                          | app icon             | Drawable resource name                                                                                                                                                                                                    |
| `android.showCancelAction`        | `boolean`                                         | `true`               | Wired to WorkManager's `createCancelPendingIntent`                                                                                                                                                                        |
| `android.cancelActionLabel`       | `string`                                          | `'Cancel'`           |                                                                                                                                                                                                                           |
| `android.foregroundServiceType`   | `'dataSync' \| 'mediaProcessing' \| 'specialUse'` | `'dataSync'`         | Must match what the plugin declared                                                                                                                                                                                       |

#### `getKnownTasks(): Promise<KnownTask[]>`

Every task this app has submitted that the library still holds a record for, newest first. Call it on launch — see [Reconciling after a silent kill](#reconciling-after-a-silent-kill).

```ts
interface KnownTask {
  id: string;
  identifierPrefix: string;
  title: string;
  subtitle: string;
  submittedAt: number; // ms since epoch
  state: ContinuedTaskState;
  completedUnitCount: number;
  totalUnitCount: number;
  stopReason?: TaskStopReason;
}
```

#### `attachToTask(id: string): Promise<ContinuedTask | undefined>`

Re-attaches to a task still running natively after the process restarted. Resolves to `undefined` when there is nothing live — always the case on iOS. Gate on `supportsReattach`.

#### `forgetTasks(ids: string[]): Promise<void>`

Drops persisted records once you have reconciled them. Unknown ids are ignored. Records are never dropped for you, so _you_ decide when reconciliation is done.

### `ContinuedTask`

A live handle to one piece of work. It owns the native task, so there are no ids to thread through your own code and no way to address a task that no longer exists.

| Member                                         | Notes                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| `id: string`                                   | `'<identifierPrefix>.<uuid>'`                                       |
| `title`, `subtitle: string`                    | As currently shown to the user                                      |
| `state: ContinuedTaskState`                    | `'pending' \| 'running' \| 'finished' \| 'stopped'`                 |
| `completedUnitCount`, `totalUnitCount: number` | Last reported progress                                              |
| `updateTitle(title, subtitle): void`           | Replaces **both**; iOS has no API for changing one alone            |
| `setProgress(completed, total): void`          | Clamped to `[0, total]`. See below                                  |
| `complete(success): void`                      | Idempotent. Not calling it is a bug                                 |
| `cancel(): void`                               | Stops with reason `app-cancelled`                                   |
| `addOnStartListener(cb): ListenerSubscription` | Fires immediately if already running, so there is no subscribe race |
| `addOnStopListener(cb): ListenerSubscription`  | See [Stop reasons](#stop-reasons)                                   |

Both listener methods return `{ remove: () => void }`. Removing stops future emissions; it does not un-deliver an event already dispatched to the JS thread.

#### Progress is load-bearing

> "Tasks that do not report any progress will be expired." — Apple

Progress is not decoration on iOS. The scheduler deprioritizes and then kills tasks that look stalled, so `setProgress` is the call that keeps your task alive. This is why `totalUnitCount` is a required submit option rather than an optional one: the task starts at a defined `0 / total` and the shape of the API pushes you toward reporting as you go.

### Stop reasons

`addOnStopListener` fires when a task stops _without_ `complete()`. Every event carries a normalized `reason` **and** the raw platform detail, because a mapped enum on its own makes these APIs undebuggable on a real device:

```ts
interface TaskStopEvent {
  taskId: string;
  reason: TaskStopReason;
  native: {
    domain: string; // 'BGTaskScheduler' | 'WorkManager'
    code?: number; // Android's WorkInfo stop reason; absent for an iOS expiration
    name: string; // e.g. 'STOP_REASON_FOREGROUND_SERVICE_TIMEOUT'
  };
}
```

| `TaskStopReason` | Platform    | Means                                                                           |
| ---------------- | ----------- | ------------------------------------------------------------------------------- |
| `user-cancelled` | both        | Cancelled from the iOS Live Activity or the Android notification action         |
| `app-cancelled`  | both        | Your own `task.cancel()`                                                        |
| `expired`        | both        | System expiration. On iOS this is where a stalled task ends up                  |
| `fgs-timeout`    | Android 15+ | The 6-hour `dataSync` budget ran out (`STOP_REASON_FOREGROUND_SERVICE_TIMEOUT`) |
| `quota`          | Android 16+ | JobScheduler quota exhausted (`STOP_REASON_QUOTA = 10`)                         |
| `app-terminated` | both        | Reconstructed on next launch; only ever seen on `KnownTask.stopReason`          |
| `unknown`        | both        | Read `native`                                                                   |

## Platform behavior you have to design around

### Submission must be foreground and user-initiated

iOS: _"Submission needs to occur as a result of a person's action, such as tapping a button."_ Submitting automatically — on a timer, from a push, during launch — gets the task cancelled. Wire `submit()` to a button, not to an effect.

### Reconciling after a silent kill

When the user swipes your app out of the app switcher, iOS cancels its continued processing tasks and, verbatim, _"the app doesn't receive an indication of cancellation in that case."_ No stop listener, no expiration handler, nothing. The same is true for requests still queued.

So the library persists a record natively at submit time and reads it back on the next launch:

```ts
useEffect(() => {
  ContinuedTasks.getKnownTasks().then(async (tasks) => {
    const orphans = tasks.filter((t) => t.stopReason === 'app-terminated');
    for (const orphan of orphans) {
      await rollBackPartialExport(orphan.id, orphan.completedUnitCount);
    }
    await ContinuedTasks.forgetTasks(orphans.map((t) => t.id));
  });
}, []);
```

On Android the worker can outlive the process, so a `KnownTask` may still be genuinely `running` — check `supportsReattach` and use `attachToTask(id)` to get the handle back rather than treating it as an orphan.

### Android's 6-hour `dataSync` cap

Targeting API 35+, all of an app's `dataSync` foreground services share **6 hours per 24-hour period**. At the limit the system calls `Service.onTimeout` and you have seconds before a `RemoteServiceException`; the library surfaces it as `fgs-timeout` and completes the worker. The budget resets when the user next foregrounds the app.

On Android 16+, JobScheduler quota also applies to jobs running alongside a foreground service, surfaced as `quota`.

If your work genuinely needs to escape both, the real semantic match for `BGContinuedProcessingTask` is a **user-initiated data transfer job** (`JobInfo.Builder.setUserInitiated(true)`, Android 14+). WorkManager exposes no UIDT API, so it would be a separate native path; this library defaults to WorkManager and documents UIDT as the escalation.

### `BGTaskScheduler.submit` and iOS 27

`BGTaskScheduler.submit(_:)` is reported as deprecated in iOS 27 in favor of `submitTaskRequest(_:completionHandler:)`. See [SDK verification](#sdk-verification-2026-08-31) for what the shipping SDK actually exposes today and how this library is structured for it.

### Duration and concurrency limits

Apple does not publish the maximum duration of a continued processing task or how many can run at once, so this README does not quote figures. The "1 refresh + 10 processing tasks" limit in `BGTaskScheduler`'s own documentation is about a different task type and does not apply.

## Config plugin

```js
[
  'react-native-continued-task',
  {
    identifierPrefixes: ['com.foo.MyApp.export'],
    enableGPU: false,
    androidForegroundServiceTypes: ['dataSync'],
  },
];
```

| Option                          | Default        | Writes                                                                           |
| ------------------------------- | -------------- | -------------------------------------------------------------------------------- |
| `identifierPrefixes`            | `[]`           | iOS `BGTaskSchedulerPermittedIdentifiers`, each expanded to `<prefix>.*`         |
| `enableGPU`                     | `false`        | iOS entitlement `com.apple.developer.background-tasks.continued-processing.gpu`  |
| `androidForegroundServiceTypes` | `['dataSync']` | Android permissions and the `tools:node="merge"` `SystemForegroundService` block |

### Bare workflow

Without Expo, do the same by hand. `Info.plist`:

```xml
<key>BGTaskSchedulerPermittedIdentifiers</key>
<array>
  <string>com.foo.MyApp.export.*</string>
</array>
```

No `UIBackgroundModes` value is needed — see [SDK verification](#sdk-verification-2026-08-31).

`AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>

<service
    android:name="androidx.work.impl.foreground.SystemForegroundService"
    android:foregroundServiceType="dataSync"
    tools:node="merge" />
```

WorkManager declares `SystemForegroundService` but not your `foregroundServiceType`, which is why the `tools:node="merge"` entry is required.

## Testing

`BGContinuedProcessingTask` cannot be tested in CI and does not work in the Simulator — `BGTaskScheduler` returns `.unavailable` there, and Apple's debug SPI for triggering tasks is device-only and grounds for App Store rejection in a shipping build. Plan for manual device QA; this repo's example app has a checklist.

`react-native-nitro-modules` ships no Jest mock and cannot be instantiated under plain Jest, so testing is split:

- **Jest** covers the JS surface — `getSubmitErrorCode`, the unsupported-platform manager, and the config plugin's mods against a fixture.
- **[React Native Harness](https://react-native-harness.dev)** covers the native surface on a real device.

## SDK verification (2026-08-31)

Verified against the **iOS 26.5 SDK** shipped with Xcode 26.5 (`BackgroundTasks.framework/Headers` and `BackgroundTasks.apinotes`), not against DocC.

**Matches the documented API.** `BGContinuedProcessingTaskRequest` (iOS 26.0+, `API_UNAVAILABLE(macos, tvos, visionos, watchos, macCatalyst)`) has exactly one initializer, `initWithIdentifier:title:subtitle:`. `title`/`subtitle` are read-write on the request and read-only on the task, with `updateTitle:subtitle:`. `BGContinuedProcessingTask` conforms to `NSProgressReporting`. `BGTaskScheduler.supportedResources` is a class property, iOS 26.0+.

**`Resources` in Swift.** `BGContinuedProcessingTaskRequestResourcesDefault = 0` carries no `NS_SWIFT_NAME`, and Swift's importer drops zero-valued `NS_OPTIONS` members, so there is **no** `.default` spelling — the empty option set `[]` is correct. Only `BGContinuedProcessingTaskRequestResourcesGPU` has `NS_SWIFT_NAME(gpu)`, giving `.gpu`.

**`SubmissionStrategy` has a trap.** The enum is declared `Fail = 0`, `Queue = 1`, but the `strategy` property documents its default as **`Queue`**. The zero value is not the default, so the library always sets `strategy` explicitly rather than relying on the raw value.

**Registration timing, undocumented elsewhere.** `registerForTaskWithIdentifier:usingQueue:launchHandler:` says launch handlers must be registered before the app finishes launching — _"(`BGContinuedProcessingTask` registrations are exempt from this requirement)"_. That exemption is what makes per-job wildcard identifiers, registered lazily at submit time, a legal design.

**`UIBackgroundModes`: not required.** `BGProcessingTask`'s header doc says it "requires setting the `processing` … capability" and `BGAppRefreshTask`'s says `fetch`. `BGContinuedProcessingTask`'s doc comment says nothing of the kind — it is the only one of the three without that sentence. Xcode ships no machine-readable enumeration of `UIBackgroundModes` values to check against, and `DVTPortalCachedPortalCapabilities.json` has no `UIBackgroundModes`-backed capability for continued processing. The evidence is negative rather than positive, but it is consistent: the config plugin writes no `UIBackgroundModes` value.

**GPU entitlement confirmed.** Xcode's `DVTPortalCachedPortalCapabilities.json` defines it as `com.apple.developer.background-tasks.continued-processing.gpu`, capability name "Background GPU Access", `BOOLEAN` with the constant value `true`, `canRequestFromPortal: false`, valid for Development, Ad Hoc, Developer ID and App Store distribution.

**Error codes confirmed:** `.unavailable = 1`, `.tooManyPendingTaskRequests = 2`, `.notPermitted = 3`, `.immediateRunIneligible = 4`. The header states `.unavailable` is what you get in the Simulator, and that `.notPermitted` also covers "the task requested additional `BGContinuedProcessingTaskRequestResources` that are unavailable".

**The iOS 27 deprecation does not exist in this SDK.** In the iOS 26.5 SDK, `BGTaskScheduler` exposes only `submitTaskRequest:error:`, mapped by apinotes to Swift `submit(_:)`, with no deprecation attribute. There is no `submitTaskRequest(_:completionHandler:)` and no `async` variant to compile against, and no availability macro to guard. The library therefore uses the throwing `submit(_:)` and isolates the call behind a single submission helper so the iOS 27 path is a one-file change once an SDK that declares it ships.

## Requirements

|              |                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| React Native | 0.75+ (0.85–0.87 best tested)                                                                           |
| iOS          | 26.0+ for continued tasks; the library builds against iOS 15+ and reports `isSupported: false` below 26 |
| Xcode        | 16.4+ (26.x to build against the iOS 26 SDK)                                                            |
| Android      | `minSdk` 24, `compileSdk` 34+, NDK 27+                                                                  |
| Nitro        | `react-native-nitro-modules` 0.37.1                                                                     |

## License

MIT
