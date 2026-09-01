# react-native-continued-task: Continued Background Tasks for React Native (iOS 26 & Android)

[![npm](https://img.shields.io/npm/v/react-native-continued-task.svg)](https://www.npmjs.com/package/react-native-continued-task)
[![npm downloads](https://img.shields.io/npm/dm/react-native-continued-task.svg)](https://www.npmjs.com/package/react-native-continued-task)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![platforms](https://img.shields.io/badge/platforms-iOS%20%7C%20Android-lightgrey.svg)
[![guide](https://img.shields.io/badge/guide-motionary.dev-FEEB00.svg)](https://motionary.dev)

Run user-initiated work that keeps going after the user leaves your app — a large export, an upload, a batch encode — behind one cross-platform API.

## Overview

**react-native-continued-task** is a React Native and Expo library for **long-running background tasks that survive the app being backgrounded**. It wraps iOS 26's [`BGContinuedProcessingTask`](https://developer.apple.com/documentation/backgroundtasks/bgcontinuedprocessingtask) and Android's [WorkManager](https://developer.android.com/topic/libraries/architecture/workmanager) foreground services behind a single typed API, so an upload, export, or batch encode the user started keeps running — with the progress UI each platform draws for it.

It is built on [Nitro Modules](https://nitro.margelo.com) with Swift on iOS and Kotlin on Android, ships an Expo config plugin, and is written for the constraints these APIs actually impose rather than hiding them.

<table>
  <tr>
    <td align="center"><b>iOS 26</b> — Live Activity on the Lock Screen</td>
    <td align="center"><b>Android</b> — foreground-service notification</td>
  </tr>
  <tr>
    <td align="center"><img src="docs/media/ios.gif" width="280" alt="iOS Live Activity showing Uploading new animations with a progress bar and a stop button" /></td>
    <td align="center"><img src="docs/media/android.gif" width="280" alt="Android notification showing Uploading new animations with a progress bar and a Cancel action" /></td>
  </tr>
</table>

Both show the same task: a title and subtitle that update as it runs, live progress, and a control to cancel it. On iOS that cancel arrives as `expired` — the system routes it through the same handler as an expiry and gives the app no way to tell them apart. On Android the same tap arrives as `user-cancelled`.

## Features

- 📱 One API over iOS 26's [`BGContinuedProcessingTask`](https://developer.apple.com/documentation/backgroundtasks/bgcontinuedprocessingtask) and Android's WorkManager foreground services
- 🔔 System-drawn progress UI — a Live Activity on iOS, an ongoing notification on Android — that the **user can cancel from**
- 📊 Progress reporting that is load-bearing, not decoration: iOS expires tasks that report none
- ♻️ `getKnownTasks()` reconciles work lost when the app is swiped away — the only way to detect it on iOS, which reports it no other way
- 🧭 Typed submit errors and stop reasons, each carrying the raw platform domain and code instead of one generic failure
- 🧩 Expo config plugin for the `Info.plist`, entitlement and `AndroidManifest` wiring
- ✅ Verified on a real device — [13/13 on iOS 26.6.1](docs/device-qa-runs/2026-09-01-ios-26.6.1.md)
- 🔥 Powered by [Nitro Modules](https://nitro.margelo.com)

> This is not a general "run some code in the background" library. Both platforms only grant this runtime to work the **user just asked for**, both show UI they can cancel from, and both kill work that looks stalled. The API is shaped around those constraints rather than hiding them.

| Platform            | Backed by                                                           |
| ------------------- | ------------------------------------------------------------------- |
| iOS 26+             | `BGContinuedProcessingTask`, with the system-provided Live Activity |
| Android (minSdk 24) | WorkManager `CoroutineWorker` running as a foreground service       |

## Installation

```sh
npm install react-native-continued-task react-native-nitro-modules
```

> **Requires a dev build.** Nitro modules never work in Expo Go.

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

## Usage

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

This is confirmed on hardware, not just read out of the header: cancelling from the Live Activity on iOS 26.6.1 reported `expired`. See the [run log](docs/device-qa-runs/2026-09-01-ios-26.6.1.md).

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

### Android 13+ needs the notification permission at runtime

The library declares `POST_NOTIFICATIONS` in its manifest, but on Android 13 (API 33) and newer that is only half the story: without a **runtime grant**, the foreground service still starts and your work still runs — the notification is just silently suppressed. The task looks like it did nothing.

The library cannot ask on your behalf, because a permission prompt needs an Activity. Request it from your app before the first submit:

```ts
import { PermissionsAndroid, Platform } from 'react-native';

if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
  await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
  );
}
```

If the user declines, submitting still works and the task still runs — they simply cannot see or cancel it. The example app does this in [`ensureNotificationPermission.ts`](example/src/qa/ensureNotificationPermission.ts).

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

| Layer                | Runs on        | Covers                                                                                                                                     | Command                                                            |
| -------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Jest                 | CI             | `getSubmitErrorCode`, the unsupported-platform manager, and the config plugin's mods against a real `AndroidManifest.xml` fixture          | `yarn test`                                                        |
| Kotlin JUnit         | CI             | The WorkManager stop-reason mapping and the persisted record's JS spellings                                                                | `./gradlew :react-native-continued-task:testDebugUnitTest`         |
| Android instrumented | emulator       | The reconciliation store and the foreground-service notification against a real Android runtime                                            | `./gradlew :react-native-continued-task:connectedDebugAndroidTest` |
| React Native Harness | emulator       | The real HybridObjects inside the real app — task lifecycle, progress clamping, stop events, listener removal                              | `yarn harness:android` — **see the caveat below**                  |
| Native compile       | CI             | That the Swift and Kotlin satisfy the generated specs                                                                                      | `yarn turbo run build:ios build:android`                           |
| Manual device QA     | iPhone, iOS 26 | Everything about `BGContinuedProcessingTask` — **13/13 passing on iOS 26.6.1, [2026-09-01](docs/device-qa-runs/2026-09-01-ios-26.6.1.md)** | the example app                                                    |

Two choices worth explaining:

**The stop-reason mapping is a pure function** (`TaskStopReasons`) so it can be unit-tested directly. Provoking a real six-hour `dataSync` timeout or a genuine `STOP_REASON_QUOTA` is not something a test can arrange, and the constants are easy to get wrong — `STOP_REASON_FOREGROUND_SERVICE_TIMEOUT` is `-128`, not a positive value, and `STOP_REASON_UNKNOWN` is `-512`. The mapping references them symbolically and the test asserts they are still negative.

**The config plugin's mods are pure and tested against fixtures.** They are the part most likely to silently break someone else's build — a dropped `.*`, a misspelled entitlement key, a missing `tools:node="merge"` — and they need no device to check.

#### Harness: wired, not yet green

The Harness suite in [`harness/`](harness/) is written and its runner starts, installs the app, boots it and bundles each test file on the emulator — but the tests do not execute yet. They fail with `ReferenceError: Property 'describe' doesn't exist`.

The cause is the Expo entry point. Harness serves an Expo manifest at `/` whose `launchAsset` points at its own entry bundle, which is the `expo-dev-client` / `expo-updates` protocol. This example's Expo native project instead bakes its entry to Metro's virtual entry (`.expo/.virtual-metro-entry.bundle`), so the app never evaluates Harness's entry and never installs the `describe`/`it`/`expect` globals. Harness's bridge _is_ injected into every bundle it serves, which is why the runner reports ready and the test files bundle successfully — the failure is only that the runtime module is missing from the bundle the app actually loads.

Making this work means getting the dev-launcher to load Harness's manifest URL on launch. Everything else about the setup — config, runner, entry, tests, the CI job — is in place and rooted correctly. Until then the native surface is covered by the Android instrumented tests and the iOS device checklist.

### iOS device QA checklist

**See [docs/DEVICE-QA.md](docs/DEVICE-QA.md) for the full walkthrough** — signing, the bundle-identifier trap, and what each result means.

The example app is a QA instrument, not a demo. It records results to disk so the checks that require backgrounding or force-quitting survive the very thing they test, grades the automatic ones itself, and hands you a markdown report at the end. You do **not** need Apple's debug SPI — unlike `BGAppRefreshTask`, a continued processing task begins immediately after submission, so tapping the button is enough.

Thirteen checks: eight automatic, two you confirm by looking at the Live Activity, three armed before the app goes away and resolved when it comes back.

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

## Who made this

Built and maintained by [Mehdi](https://github.com/mahdidavoodi7)
([@mehdi_made](https://x.com/mehdi_made) on X), the developer behind
[Motionary](https://motionary.dev), a library of premium, production-ready React Native animations
and interactions hand-crafted with Reanimated, Skia, Gesture Handler and Expo. This library came out
of the far end of that work. A long export with a beautifully animated progress screen in front of it
is still a broken feature if the work dies the second someone switches apps, and the progress bar
nobody is looking at is the one that has to keep moving. iOS 26 finally has a real answer for that,
Android has had one for years under a different name, and the two disagree about almost every detail,
so the disagreements are written down here instead of smoothed over.

If you're here for the visual half of the same problem:

- [React Native animations](https://motionary.dev/animations): the drops, copy-paste animation
  components with the interaction already tuned
- [Builds](https://motionary.dev/builds): real React Native apps shipped end to end, with the drops inside
- [Free React Native components](https://motionary.dev/components): a copy-paste reference set
- [The Motionary blog](https://motionary.dev/blog), including
  [the best React Native UI libraries in 2026](https://motionary.dev/blog/best-react-native-ui-libraries-2026)
  and [why shape beats shimmer in skeleton loading](https://motionary.dev/blog/react-native-skeleton-loading)

## Contributing

Issues and PRs welcome, especially reports from hardware this has not run on yet: a non-iPhone iOS 26
device, an Android 15 or 16 handset that can actually reach the six-hour `dataSync` cap, or a
`STOP_REASON_QUOTA` seen in the wild. See [CONTRIBUTING.md](CONTRIBUTING.md) for the dev loop, and
[docs/DEVICE-QA.md](docs/DEVICE-QA.md) if you want to re-run the iOS checklist and add a run log.

## FAQ

**Does it work in Expo Go?**
No. Nitro modules need native code, so Expo Go can never load them. Use a development build (`npx expo prebuild` then `expo run:ios` / `run:android`).

**Can I test this on the iOS Simulator?**
No. `BGTaskScheduler` returns `.unavailable` on the Simulator — Apple documents this in the SDK header. `isSupported` reports `false` there and every submission rejects. iOS behaviour has to be verified on a physical device running iOS 26+; see [docs/DEVICE-QA.md](docs/DEVICE-QA.md).

**How long can a continued processing task run on iOS?**
Apple does not publish a maximum duration or a concurrent-task ceiling, so this library does not quote figures. The "1 refresh + 10 processing tasks" limit in `BGTaskScheduler`'s documentation is about a different task type and does not apply here.

**What happens when the user swipes my app out of the app switcher?**
iOS cancels the task and — verbatim from Apple — "the app doesn't receive an indication of cancellation in that case." No stop listener, no expiration handler. Call [`getKnownTasks()`](#getknowntasks-promiseknowntask) on your next launch; work interrupted that way comes back with the `app-terminated` stop reason.

**Why does cancelling from the Live Activity report `expired` instead of `user-cancelled`?**
Because iOS routes user cancellation and system expiry through the same zero-argument `expirationHandler`, with nothing to distinguish them. This library reports what it can justify rather than guessing. Android _can_ tell them apart, and reports `user-cancelled`.

**My Android notification never appears. Is the task running?**
Almost certainly yes. On Android 13+ you must request `POST_NOTIFICATIONS` at runtime — without the grant the foreground service still starts and the work still runs, but the notification is suppressed. See [Android 13+ needs the notification permission at runtime](#android-13-needs-the-notification-permission-at-runtime).

**How is this different from `expo-background-task` or `BGProcessingTask`?**
Those schedule deferrable work the system runs _later_, when conditions are favourable — you do not control when, and the user sees nothing. A continued processing task starts **immediately**, because the user just asked for it, and the system shows them progress they can cancel. Different tool for a different job.

**Do I need the background GPU entitlement?**
Only for tasks submitted with `ios.requiresGPU`. Non-GPU work needs no entitlement. Note that `com.apple.developer.background-tasks.continued-processing.gpu` is valid only for paid Apple Developer Program teams — a free personal team cannot sign it.

**Does it work without Expo?**
Yes. The Expo config plugin is a convenience; the [Bare workflow](#bare-workflow) section lists the `Info.plist` and `AndroidManifest.xml` entries to add by hand.

## Related resources

- [motionary.dev](https://motionary.dev?utm_source=github&utm_medium=readme&utm_campaign=react-native-continued-task) — React Native components, animations and guides
- [Apple: Finish tasks in the background (WWDC25 session 227)](https://developer.apple.com/videos/play/wwdc2025/227/) — the iOS behaviour this library wraps
- [`BGContinuedProcessingTask` documentation](https://developer.apple.com/documentation/backgroundtasks/bgcontinuedprocessingtask)
- [Android: long-running workers](https://developer.android.com/develop/background-work/background-tasks/persistent/how-to/long-running)
- [Nitro Modules](https://nitro.margelo.com) — the native module framework this is built on

## Sponsor

Built and maintained by [**motionary.dev**](https://motionary.dev?utm_source=github&utm_medium=readme&utm_campaign=react-native-continued-task) — free, and free to use.

If this saved you a week of reading Apple's background-task documentation, take a look at what else is over there.

## License

MIT
