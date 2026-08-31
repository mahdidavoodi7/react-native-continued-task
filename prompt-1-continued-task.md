# Build prompt — `react-native-continued-task`

> Paste everything below into a fresh Claude Code session in an empty directory.

---

Build and ship a React Native library called **`react-native-continued-task`** that wraps iOS 26's `BGContinuedProcessingTask` and Android's WorkManager foreground-service equivalent behind one cross-platform API.

Nothing on npm wraps `BGContinuedProcessingTask` as of August 2026 — I checked `expo-background-task` (331k weekly downloads) and it only uses the old `BGProcessingTask`. This is greenfield.

## Stack — non-negotiable

- **Nitro Modules**, pinned to `react-native-nitro-modules@0.37.1` and `nitrogen@0.37.1` (keep both on the same minor — nitrogen depends on `^0.37.1`).
- Swift on iOS, Kotlin on Android. No Objective-C, no C++ beyond the generated CMake boilerplate.
- Scaffold with `npx create-react-native-library@latest` and pick the **"Nitro module"** template (language must be `kotlin-swift`). Use this rather than `npx nitrogen init` — the official Nitro template ships no example app and **no `react-native-builder-bob`**, so `npm publish` from it produces a broken package with no `lib/`.
- Minimums: RN 0.75+, Xcode 16.4+, Swift 5.9+, `compileSdk` 34+, NDK 27+. Target RN 0.85–0.87 as the best-tested band.

## Verified iOS API — build against exactly these symbols

I verified all of this against Apple's DocC endpoints on 2026-08-30. **The WWDC25 session 227 code samples do not compile against the shipping API** — they show a single-argument `register(_:launchHandler:)` that does not exist, and force-unwrap a throwing `submit`. Ignore session code; use these signatures.

```swift
class BGContinuedProcessingTaskRequest: BGTaskRequest      // iOS 26.0+, iPadOS 26.0+
init(identifier: String, title: String, subtitle: String)  // the only initializer

var title: String
var subtitle: String
var strategy: BGContinuedProcessingTaskRequest.SubmissionStrategy   // .queue (default) | .fail
var requiredResources: BGContinuedProcessingTaskRequest.Resources   // OptionSet; .gpu

class var BGTaskScheduler.supportedResources: BGContinuedProcessingTaskRequest.Resources
```

```swift
class BGContinuedProcessingTask: BGTask                    // conforms to Foundation.ProgressReporting
var title: String { get }                                  // read-only after init
var subtitle: String { get }
func updateTitle(_ title: String, subtitle: String)        // title unlabeled, subtitle labeled; pass both every time
var progress: Progress                                     // real Foundation.Progress
// inherited from BGTask:
var identifier: String { get }
var expirationHandler: (() -> Void)?
func setTaskCompleted(success: Bool)
```

Registration:

```swift
BGTaskScheduler.shared.register(forTaskWithIdentifier: id, using: nil) { task in
    guard let task = task as? BGContinuedProcessingTask else { return }
    ...
} // -> Bool; false if the identifier isn't covered by BGTaskSchedulerPermittedIdentifiers
```

### The seven iOS behaviors that will break a naive wrapper

1. **Double registration kills the app.** Apple: *"The system kills the app on the second registration of the same task identifier."* Because we're using wildcard identifiers with per-job concrete IDs, you **must** keep a native `Set<String>` of already-registered identifiers and guard every `register` call. A JS-side double-call must be a no-op, never a crash.
2. **Progress is load-bearing, not cosmetic.** *"Tasks that do not report any progress will be expired."* The system deprioritizes and kills stalled tasks. Design the API so it's hard to forget to report progress, and document the consequence.
3. **`earliestBeginDate` is inherited but explicitly ignored** in favor of `Date.now`. Do not expose it.
4. **Submission must be foreground + user-initiated.** *"Submission needs to occur as a result of a person's action, such as tapping a button."* Automatic/background submission gets tasks cancelled. Surface this in the README and in the error path.
5. **App swiped from the app switcher = silent cancellation.** Verbatim: *"the app doesn't receive an indication of cancellation in that case."* No callback, no expiration handler. Your API must let apps reconcile orphaned state on next launch — persist submitted task IDs natively and expose a `reconcile()` / `getKnownTasks()` call.
6. **`BGTaskScheduler.submit(_:)` is deprecated as of iOS 27.0**, replaced by `submitTaskRequest(_:completionHandler:)` / `try await submitTaskRequest(_:)` (iOS 27.0+). Implement both paths behind `if #available(iOS 27, *)`.
7. **User cancellation arrives only via `expirationHandler`.** The system shows a Live Activity with your title/subtitle and progress, and the user can cancel there. You do not build an ActivityKit activity — the system provides it.

### Identifier and Info.plist rules

Wildcard notation: put `com.foo.MyApp.export.*` in `BGTaskSchedulerPermittedIdentifiers`, then register and submit a concrete expansion like `com.foo.MyApp.export.<uuid>`. The prefix must start with the bundle ID.

Apple's docs contradict themselves on whether the wildcard is mandatory (the initializer page says "must", their own article uses a plain static ID, WWDC227 says "in addition to static identifiers"). **Use the wildcard form** — it satisfies both readings and is the only shape that supports concurrent per-job IDs.

No `UIBackgroundModes` value appears to be required — unlike `BGAppRefreshTask`/`BGProcessingTask`. I could not positively confirm this from the `UIBackgroundModes` enumeration page, so **verify against the SDK plist schema early** and tell me what you find.

GPU access needs the entitlement `com.apple.developer.background-tasks.continued-processing.gpu` (Boolean `true`, Xcode capability "Background GPU Access"). Non-GPU work needs no entitlement. Always gate on `BGTaskScheduler.supportedResources.contains(.gpu)` before setting `requiredResources` — requesting unsupported resources fails submission with `.notPermitted`.

Errors from `submit()` — `BGTaskScheduler.Error.Code`: `.notPermitted`, `.tooManyPendingTaskRequests`, `.unavailable`, `.immediateRunIneligible` (only with `.fail` strategy). Map each to a distinct typed error in JS; do not collapse them into one generic failure.

**Undocumented, so do not invent numbers:** the maximum task duration and the concurrent-task ceiling are not published anywhere. Do not put figures in the README. (And do not reuse the "1 refresh + 10 processing" limit from `submit(_:)` — that's for a different task type.)

## Verified Android API

`CoroutineWorker` + `setForeground()`, on `androidx.work:work-runtime:2.11.2` (current stable; 2.11.0 raised minSdk to 23).

```kotlin
class ContinuedTaskWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        setForeground(foregroundInfo(0))
        // ensureActive() in the loop; setProgress(workDataOf(...))
    }
}
```

Traps:

- On `CoroutineWorker`, `getForegroundInfoAsync()` and `onStopped()` are **`final`** — you cannot override them. Override the suspend `getForegroundInfo()` instead, and use coroutine cancellation (`ensureActive()`, `try/finally`) as the stop signal.
- `getForegroundInfo()` is the *expedited-work* path and throws `IllegalStateException` if unimplemented. For long-running work call `setForeground(...)` from inside `doWork()`. Without it a `CoroutineWorker` is capped at ten minutes.
- The manifest needs the `tools:node="merge"` service block — WorkManager declares `SystemForegroundService` but not your `foregroundServiceType`:

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
<service android:name="androidx.work.impl.foreground.SystemForegroundService"
         android:foregroundServiceType="dataSync" tools:node="merge" />
```

- **Android 15+ (targeting API 35): `dataSync` gets 6 hours per 24-hour period**, tracked per-type and shared across all services of that type. At the limit the system calls `Service.onTimeout(int, int)` and you have seconds to stop or you get a `RemoteServiceException`. The timer resets when the user foregrounds the app. Surface `WorkInfo.STOP_REASON_FOREGROUND_SERVICE_TIMEOUT` to JS as a distinct reason.
- **Android 16+ (running, regardless of target):** JobScheduler quota now applies to jobs running alongside a foreground service. Google's own WorkManager guide warns long-running workers can exhaust the app's job quota. Handle `STOP_REASON_QUOTA = 10`.
- Observe with `getWorkInfoByIdFlow(id)` (added 2.9.0) — best fit for bridging to JS. Cancel with `cancelWorkById`; add a notification cancel action via `createCancelPendingIntent(id)`.
- **Do not use `setExpedited()`** — Google is explicit that expedited work is for short tasks.
- Note in the README that the true semantic match for `BGContinuedProcessingTask` is a **user-initiated data transfer (UIDT) job** (`JobInfo.Builder.setUserInitiated(true)`, Android 14+), which escapes both the 6h cap and the Android 16 quota — but WorkManager exposes no UIDT API, so it would be a separate native path. Default to WorkManager; document UIDT as the escalation.

## API design

Model this on the actual constraints above, not on a generic "start a background job" abstraction. Something like:

```ts
export interface ContinuedTask extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  readonly isSupported: boolean          // iOS 26+ / Android with the perms granted
  readonly supportsGPU: boolean          // BGTaskScheduler.supportedResources.contains(.gpu)

  submit(options: TaskOptions, onProgress: (p: TaskProgress) => void): Promise<string>  // -> task id
  updateTitle(id: string, title: string, subtitle: string): void
  setProgress(id: string, completed: number, total: number): void
  complete(id: string, success: boolean): void
  cancel(id: string): void

  getKnownTasks(): Promise<TaskRecord[]>   // for reconciling after a silent kill
  addStopListener(cb: (e: { id: string; reason: StopReason }) => void): void
}
```

Nitro has **no event system by design** — callbacks are just functions you retain natively and call as often as you like, and they're scheduled onto the JS thread so they're safe from any thread. Use callback parameters and subscribe-style `addXListener(cb)` methods. There is no `addListener`/`NativeEventEmitter`/`emit`. Model unsubscribe yourself (return a handle with `remove()`, or accept a token).

For the Promise side: return `Promise.async { }` in Swift and `Promise.async { }` in Kotlin, and validate arguments **synchronously before** entering the async block so bad input throws while the JS thread is still blocked. `Promise.parallel` if you need a dedicated thread.

Make `StopReason` a discriminated union that preserves platform specificity — `'user-cancelled' | 'expired' | 'fgs-timeout' | 'quota' | 'app-terminated' | 'unknown'` — and always include the raw native error domain/code alongside it. Mapped-enum-only error surfaces make these APIs undebuggable.

## Deliverables

1. Scaffolded library, `nitro.json` correctly configured (`cxxNamespace`, `ios.iosModuleName` matching the podspec name exactly, `android.androidNamespace`, `android.androidCxxLibName`, and the `autolinking` entry), `ignorePaths: ["**/node_modules"]`.
2. Swift + Kotlin implementations. Kotlin classes need **both** `@Keep` and `@DoNotStrip` (the docs mention only the latter; Nitro's own repo uses both). Get Android `Context` via `NitroModules.applicationContext`, not a constructor arg.
3. `nitrogen/generated/` **committed to git and shipped in the npm `files` array** — consumers must never run nitrogen.
4. An **Expo config plugin** in the same package (`app.plugin.js` → `plugin/src/index.ts`) that writes `BGTaskSchedulerPermittedIdentifiers`, the GPU entitlement when opted in, and the Android permissions + merged service block. Note there is no official Nitro+Expo documentation — `react-native-nitro-google-signin` is the working reference for this combo. Nitro modules never work in Expo Go; require a dev build and say so in the README.
5. Example app exercising: a real long-running job with live progress, user cancellation from the Live Activity, GPU-gated work, and the app-terminated reconciliation path.
6. Tests. `react-native-nitro-modules` ships no Jest mock and cannot be instantiated in plain Jest. Use **React Native Harness** (`react-native-harness.dev`, Callstack) for on-device native tests, plus plain Jest against a mocked JS wrapper layer. Split `index.ts` / `index.native.ts` so the JS surface stays testable.
7. `package.json` with `react-native-builder-bob`, and — critically — `react-native-nitro-modules` as an **optional peer dependency**:
8. use this skill: `npx skills add https://github.com/margelo/react-native-skills --skill build-nitro-modules`

```json
"peerDependencies": { "react": "*", "react-native": "*", "react-native-nitro-modules": "*" },
"peerDependenciesMeta": { "react-native-nitro-modules": { "optional": true } }
```

Without `optional`, semver ranges don't match pre-releases, a second nested copy gets installed, and the app crashes with `Nitro was installed twice`.

8. README covering: the foreground/user-initiated requirement, that progress reporting is mandatory, the silent-cancellation-on-swipe behavior, Android's 6h `dataSync` cap, and the iOS 27 `submit` deprecation.

## Ground rules

- **Verify every Apple symbol against the real SDK before writing much code.** I verified against DocC, but DocC and shipping SDKs drift. Report anything that doesn't match — especially the `UIBackgroundModes` question and the Swift spelling of the default `Resources` value (DocC only names the ObjC symbol `BGContinuedProcessingTaskRequestResourcesDefault`; use the empty option set `[]` until you confirm otherwise).
- Do not invent duration or concurrency limits. They're unpublished.
- `BGContinuedProcessingTask` cannot be tested in CI and probably not in the Simulator (Apple's debug SPI is documented as device-only, and using it in a shipping build is grounds for App Store rejection). Plan for manual device QA and say so.
- Start by writing the TypeScript spec file and the README API section. Show me those before implementing native code.
