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

#### iOS cannot tell you the user cancelled

`BGContinuedProcessingTask` delivers user cancellation and system expiration through the same `expirationHandler`, which takes no arguments. There is nothing in the shipping SDK that distinguishes them, so this library reports `'expired'` with `native.name` of `'expirationHandler'` rather than guessing at `'user-cancelled'`. Treat the two as one case on iOS. Android _can_ distinguish them, and does.

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

`BGContinuedProcessingTask` cannot be tested in CI and does not work in the Simulator — `BGTaskScheduler` returns `.unavailable` there, and Apple's debug SPI for triggering tasks is device-only and grounds for App Store rejection in a shipping build. Everything else is automated.

| Layer                | Runs on        | Covers                                                                                                                            | Command                                                            |
| -------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Jest                 | CI             | `getSubmitErrorCode`, the unsupported-platform manager, and the config plugin's mods against a real `AndroidManifest.xml` fixture | `yarn test`                                                        |
| Kotlin JUnit         | CI             | The WorkManager stop-reason mapping and the persisted record's JS spellings                                                       | `./gradlew :react-native-continued-task:testDebugUnitTest`         |
| Android instrumented | emulator       | The reconciliation store and the foreground-service notification against a real Android runtime                                   | `./gradlew :react-native-continued-task:connectedDebugAndroidTest` |
| React Native Harness | emulator       | The real HybridObjects inside the real app — task lifecycle, progress clamping, stop events, listener removal                     | `yarn harness:android` — **see the caveat below**                  |
| Native compile       | CI             | That the Swift and Kotlin satisfy the generated specs                                                                             | `yarn turbo run build:ios build:android`                           |
| Manual device QA     | iPhone, iOS 26 | Everything about `BGContinuedProcessingTask`                                                                                      | the example app                                                    |

Two choices worth explaining:

**The stop-reason mapping is a pure function** (`TaskStopReasons`) so it can be unit-tested directly. Provoking a real six-hour `dataSync` timeout or a genuine `STOP_REASON_QUOTA` is not something a test can arrange, and the constants are easy to get wrong — `STOP_REASON_FOREGROUND_SERVICE_TIMEOUT` is `-128`, not a positive value, and `STOP_REASON_UNKNOWN` is `-512`. The mapping references them symbolically and the test asserts they are still negative.

**The config plugin's mods are pure and tested against fixtures.** They are the part most likely to silently break someone else's build — a dropped `.*`, a misspelled entitlement key, a missing `tools:node="merge"` — and they need no device to check.

#### Harness: wired, not yet green

The Harness suite in [`harness/`](harness/) is written and its runner starts, installs the app, boots it and bundles each test file on the emulator — but the tests do not execute yet. They fail with `ReferenceError: Property 'describe' doesn't exist`.

The cause is the Expo entry point. Harness serves an Expo manifest at `/` whose `launchAsset` points at its own entry bundle, which is the `expo-dev-client` / `expo-updates` protocol. This example's Expo native project instead bakes its entry to Metro's virtual entry (`.expo/.virtual-metro-entry.bundle`), so the app never evaluates Harness's entry and never installs the `describe`/`it`/`expect` globals. Harness's bridge _is_ injected into every bundle it serves, which is why the runner reports ready and the test files bundle successfully — the failure is only that the runtime module is missing from the bundle the app actually loads.

Making this work means getting the dev-launcher to load Harness's manifest URL on launch. Everything else about the setup — config, runner, entry, tests, the CI job — is in place and rooted correctly. Until then the native surface is covered by the Android instrumented tests and the iOS device checklist.

### iOS device QA checklist

The example app is a checklist, not a demo: one button per row, with a live log. Build it to a physical iPhone on iOS 26 and work down the list. You do **not** need Apple's debug SPI — unlike `BGAppRefreshTask`, a continued processing task begins immediately after submission, so tapping the button is enough.

1. **Double submit** — tap twice quickly. Two tasks, no crash. This is the one that _kills the app_ if the native registration guard is wrong, so it goes first.
2. **Submit without progress** — background the app and wait. Expect a stop with reason `expired`.
3. **Cancel from the Live Activity** — background, then cancel. Expect `expired` (iOS cannot distinguish this from an expiry).
4. **Swipe the app away** — relaunch and check the reconcile lines. Expect one `app-terminated` record and no stop listener having fired. This cannot be automated; nothing on the device can simulate the swipe.
5. **GPU-gated work** — check `supportsGPU`, then submit with `requiresGPU`.
6. **Unpermitted identifier** — expect `not-permitted`, not a crash.
7. **Cancel from the app** — expect `app-cancelled`.

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
