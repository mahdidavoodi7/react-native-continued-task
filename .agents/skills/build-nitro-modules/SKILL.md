---
name: build-nitro-modules
description: Builds and designs React Native Nitro Modules with Nitrogen, HybridObject TypeScript specs, Nitro View components, generated native implementations, zero-copy and native-state APIs, Swift/Kotlin/C++ bindings, example apps, and testing. Use when creating a Nitro Module, adding or reviewing HybridObjects, building a Nitro View (HybridView) component, designing Nitro-specific public APIs, implementing native functionality, or setting up the nitrogen codegen pipeline. Pair with api-design for general library API shape.
license: MIT
metadata:
  author: margelo
  tags: react-native, nitro-modules, nitrogen, hybrid-object, api-design, swift, kotlin, c++, monorepo, native-modules, codegen
---

# Build Nitro Modules

## Overview

End-to-end skill for building a React Native Nitro Module: monorepo scaffolding via Nitrogen, TypeScript HybridObject spec authoring, native code generation, platform implementation (C++/Swift/Kotlin), example app wiring, and publish preparation.

Nitro Modules use a codegen pipeline (`nitrogen`) that reads `.nitro.ts` spec files and generates native C++/Swift/Kotlin boilerplate. You then fill in the implementation. This is fundamentally different from old-style turbo modules.

Generated files under `nitrogen/generated/` are outputs. Change the `.nitro.ts` spec or native implementation source, then re-run nitrogen instead of manually editing generated files. These files can be committed to git, and many Nitro libraries do commit them, but the repo policy can choose otherwise. They must be included in the npm package so consumers can build the native library.

## Pair With API Design

Use `api-design` first when shaping the public TypeScript, JavaScript, React, or React Native API. This skill adds the Nitro-specific constraints: HybridObject state, generated specs, native resource ownership, zero-copy data, threading, platform implementation, codegen, and real-device validation.

Let `api-design` own general public API rules and API freshness checks. In this skill, only add Nitro-specific freshness checks for mobile toolchain and generated-template decisions: verify current Nitro, React Native, Gradle, Xcode, Swift, Kotlin, NDK, and package-tooling docs/source before choosing versions, config fields, or native implementation details.

If the user is building a JS-only React or React Native library, do not apply this skill unless Nitro, HybridObjects, native modules, codegen, C++/Swift/Kotlin bindings, or `react-native-nitro-modules` are part of the task.

Pair with `swift` when implementing or reviewing Swift-backed HybridObjects, AVFoundation/session code, DispatchQueue usage, Swift concurrency, or thread-affine Swift state. Pair with `kotlin` when implementing or reviewing Kotlin-backed HybridObjects, Android threading, coroutines, Kotlin nullability, sealed result models, or Android service access. Pair with `cpp` when implementing or reviewing C++-backed HybridObjects, shared native engines, CMake, RAII ownership, or generated C++ spec bindings.

## Repo and Release References

Load [repo-structure-and-workflow.md][repo-structure-and-workflow] only when creating a repo, reorganizing layout, adding examples/docs/CI, or changing workflow policy.

Load [release-it-publishing.md][release-it-publishing] only when setting up or reviewing `bun release` / `release-it`.

## Nitro API Design Rules

- Prefer Nitro Modules over TurboModules or handwritten JSI for native module work. Nitro is usually faster and safer because it avoids many raw JSI lifetime, threading, and runtime-destruction hazards. Use raw JSI only when Nitro's Raw JSI Methods are required.
- Keep the root HybridObject default-constructible for autolinking. Create argument-dependent objects through factory methods.
- Use HybridObjects for native state: native resources, prewarmed engines, files, images, databases, sensor sessions, streams, and other stateful objects.
- If native setup is required, make the factory method async and resolve with a ready HybridObject, such as `createCameraSession(...): Promise<CameraSession>`.
- One JS-facing HybridObject spec can have multiple native concrete classes implementing the generated spec. Use this to hide backend strategies behind one TypeScript type, for example `CameraVideoOutput` backed by either a movie-file output or a video-data-output plus asset writer. Factories choose the native implementation and return the shared spec type.
- Use a product/domain noun for the exported JS factory object, not the generated spec type name. For example, export `VisionCamera = createHybridObject<CameraFactory>('CameraFactory')` or `Images = createHybridObject<ImageFactory>('ImageFactory')`. This avoids collisions with `CameraFactory`/`ImageFactory` types without mechanically lowercasing them or adding `Hybrid` prefixes.
- Keep each HybridObject scoped to one purpose or lifecycle.
- Do not choose HybridObject boundaries only by domain noun. A one-shot command, an app-owned live session, a native view, and a long-lived engine are different contracts even when they belong to the same feature area.
- Split returned HybridObjects by stable semantic capability when their options, results, lifecycle, or future platform support differ. For example, a root `DataScannerFactory` can expose `createBarcodeScanner()` and `createTextScanner()` instead of one broad scanner whose text fields are nullable because Android currently supports only barcodes.
- It is valid for a factory to report `isTextScannerAvailable: false` or reject `createTextScanner()` on platforms that do not support that capability today. Future platform support should fill in the existing capability and flip availability to true, not require redesigning a fat HybridObject.
- Platform-specific capabilities can still be first-class HybridObjects when the concept is stable. For example, an iOS-only `CameraObjectOutput` can extend a shared `CameraOutput`, be marked `@platform iOS`, and reject at `createObjectOutput(...)` on Android instead of adding object-scanning nullable fields to every output.
- Use factory methods to separate workflows and make returned HybridObjects stronger. If `createLiveScanner()` returns a live scanner session, baseline session operations that the implementation controls should be guaranteed by that type. Backends that cannot provide the live workflow should fail creation or return a narrower object, not force the live object to expose dead methods, nullable baseline properties, or repeated `can*` checks.
- Return configured handles to avoid stale state. If `configure(...)` binds a device, output, stream, or native graph, return a new HybridObject handle for commands that only make sense for that configured resource. For example, a `CameraSession.configure(...)` method should return `CameraController` handles for `setZoom(...)` and `focusTo(...)` instead of putting those methods on `CameraSession` with implicit "current device" state.
- Reconfiguration should replace or invalidate handles whose native target changed. Do not keep commands on a broad parent HybridObject when the command target depends on the last successful configuration.
- For native negotiation, model requested intent separately from resolved state. Use ranked constraints or preferences as input, then return or emit a resolved config HybridObject/struct that describes what the session actually selected. Provide an explicit resolver method when callers need to preview the result without creating or starting the native session.
- Use capability fields for workflow discovery, optional preferences, and genuinely variable support. Do not use capabilities to paper over an oversized HybridObject whose methods are unsupported during normal use on a supported backend.
- Treat HybridObjects as primary API objects. Each primary HybridObject gets its own `.nitro.ts` file.
- Keep an inheritance family in one `.nitro.ts` file only when the file is named after the base HybridObject and child HybridObjects add few or no members, such as `ScannedCode`, `ScannedBarcode`, and `ScannedQRCode` in `ScannedCode.nitro.ts`.
- Put named codegen types in their own `.ts` files: string-literal unions/enums, structs/interfaces, option objects, event objects, callback option structs, and helper types. Nitro needs names for generated native structs and enum-like values. Import them into `.nitro.ts` specs and re-export public types from `src/index.ts`.
- Inline simple function callbacks in method signatures, for example `addErrorListener(listener: (error: Error) => void): ListenerSubscription`. Do not create one-off aliases such as `ScannerErrorListener` unless the function type is reused as a public concept across multiple APIs.
- Group multiple helper types in one file only when they form one tightly coupled logical construct, such as `DynamicRange` plus the exact literal unions that define it.
- Use HybridObject inheritance for shared native state plus specialized result shapes. Put shared properties such as IDs, bounds, raw values, formats, and value types on the base object instead of repeating them on every subtype.
- Use HybridObject inheritance for heterogeneous native result families. Example: `ScannedItem` owns common state and methods, while `ScannedBarcode`, `ScannedQRCode`, and `ScannedFace` extend it with specialized properties. APIs can return `ScannedItem[]`; JS narrows by a discriminator property, and native code can accept the generated base spec when it only needs common behavior.
- Do not model state families as one Nitro struct or HybridObject with every subtype field nullable. Use HybridObject inheritance, discriminated unions, or platform protocol/interface conformance so relationships such as `barcode` plus `barcodeType` are compile-time safe.
- Treat public Nitro HybridObjects as the imperative API. Export the generated Nitro API 1:1 when it is intended for users; do not add JS wrappers that pre-parse values, translate strings/enums, reshape options, inject hidden defaults, or call a different internal method shape than the `.nitro.ts` spec exposes.
- JS/TS layers are appropriate for intentionally higher-level APIs such as React hooks, React components, UI composition helpers, or when the HybridObject is only an internal implementation detail and does not match the user-facing mental model. In those cases, keep the boundary explicit: the wrapper is the public API and the Nitro object is internal.
- Autolink only public roots, factories, views, or global utilities that JS must construct directly. Other HybridObjects can be returned from factory methods and do not need their own `nitro.json` autolinking entries. Do not autolink every concrete native implementation of the same JS-facing spec.
- For native extension points, pair a JS-facing base HybridObject spec with a public native protocol/interface. The base spec lets JS pass the object through typed APIs; the native protocol/interface exposes platform-specific handles and behavior for first-party and third-party native code.
- When accepting an extensible HybridObject from JS, accept the generated base spec type, then cast to the native protocol/interface on the native side and throw a clear error if it does not conform. This keeps JS portable while native integrations stay strongly typed.
- Use Nitro structs for domain shapes, option groups, and same-type parameter clusters. Do not wrap unrelated hot-path values in a struct only to reduce argument count; Nitro eagerly converts structs, so unnecessary wrappers can be slower than explicit parameters.
- Remember that TypeScript optional fields become native optionals (`T?` / `std::optional<T>`) in generated Swift, Kotlin, and C++. Use optional Nitro fields only when absence is part of the intended public/native contract, not because a JS wrapper will translate them away.
- Prefer the Nitro method's generated structs to be the real public input shape. If defaults or resolved options are needed, model them explicitly in the spec/native implementation or provide a deliberately higher-level API above an internal HybridObject; do not add a casual JS normalization layer over a public HybridObject.
- Do not model high-volume native results, parsed payloads, images, buffers, or objects with many optional expensive fields as flat structs. Nitro structs are eagerly converted, so prefer stateful HybridObjects with lazy properties or methods for data the caller may never read.
- Decide explicitly whether each result should be a Nitro struct or HybridObject. A small immutable result with cheap scalar fields can be a struct. Use a HybridObject when the result owns native state, may expose lazy expensive data, needs zero-copy binary access, or is likely to grow behavior/methods.
- Use `ArrayBuffer` for small or truly zero-copy native data access. For large media, photos, scans, model outputs, or byte payloads, return a HybridObject and expose lazy methods such as `toArrayBuffer()`, `toBase64()`, or `saveToTemporaryFile()` instead of eagerly converting bytes into JS.
- Do not choose `ArrayBuffer` only because it is zero-copy. Use `string` for decoded text payloads and `ArrayBuffer` for raw bytes, binary payloads, media, or opaque data where byte-level access is the API contract.
- Keep raw native state behind HybridObjects when conversion cost matters. For example, a native barcode/photo/result object can expose `rawValue`, `bounds`, `format`, or byte data lazily instead of converting every field for every detection.
- For repeated events, prefer `addOn...Listener(callback): ListenerSubscription` and let each subscription own its cleanup. This avoids one caller replacing another caller's callback through shared object state.
- Listener subscriptions should be flat structs with a `remove: () => void` function field, not HybridObjects, unless they expose native state beyond cleanup. Call sites still use `subscription.remove()`.
- Listener cleanup should stop future emissions. It does not need to cancel a callback already selected by an in-flight native event snapshot, so do not add locks or complex subscription state only for that guarantee.
- Do not lock listener add, remove, and callback invocation as a default implementation pattern. Prefer one owner thread/queue or immutable snapshots; add a lock only for a proven shared mutable race that cannot be removed by ownership.
- Use a `setOn...(callback | undefined)`-style API only for single hot-path callbacks owned by an object, where replacing or removing the callback is the natural operation. The `set` verb and docs must make the replacement semantics clear.
- If the native API exposes only one delegate/callback but the JS API is a repeated event, prefer multiplexing internally and exposing additive listeners unless doing so would be unsafe or too expensive for the hot path.
- Use `Sync<(...) => ...>` callbacks only for rare thread-bound hot paths that must synchronously execute on a specific JS runtime or worklet thread.
- For Nitro Views, expose the raw `getHostComponent` wrapper. Add React components or hooks only when they remove repeated setup code while staying layered over the same native objects and refs. Load [spec-hybrid-view.md][spec-hybrid-view] when creating or reviewing a Nitro View component.
- Follow `api-design` for naming, platform abstraction, sync/async boundaries, listener cleanup, errors, variants, TypeScript facades, and JSDoc contracts.

## Nitro Native Implementation Rules

- Check Nitro's current minimum requirements before debugging weird build failures. Current Nitro docs list React Native 0.75+, Xcode 16.4+, Swift 5.9+, Android `compileSdkVersion` 34+, and NDK 27+; Nitro Views currently require React Native 0.78+ and the New Architecture.
- Every native HybridObject implementation must implement or inherit from the generated `Hybrid*Spec` for that platform. Never implement a standalone native class and expect Nitro to discover it.
- Make native implementation classes `final` by default unless inheritance is genuinely required. This is especially true for Swift and Kotlin HybridObjects.
- Keep exactly one top-level native implementation type per file. A `Hybrid*Factory.swift`/`.kt` file contains the `Hybrid*Factory` type and no other structs/classes/enums/interfaces/protocols. Helper sessions, coordinators, delegates, option adapters, and platform wrappers go in their own files.
- Do not nest helper types inside the primary type to avoid file splitting. Give helper types their own named files.
- Treat native filenames as scope contracts. A file named after a HybridObject should focus on that HybridObject's implementation, not collect extension methods/properties, platform helpers, converters, delegates, protocols, or reusable utilities.
- Use line count as a review signal for native files: below roughly 300 lines is usually acceptable only after the one-type-per-file and no-helpers-in-factory rules are satisfied. If the size comes from helpers that could be named separately, split the file.
- Put native conversion helpers on the smallest meaningful type. If a native conversion only reads one generated struct or enum, put it on that type even when it returns multiple native values. Keep collection composition at the call site unless the collection conversion adds real behavior such as deduplication, validation, nonempty checks, batching, or error aggregation.
- Never put domain conversions on broad native/common receivers such as Kotlin `Int` or Swift `Int`. Use the domain type's companion, static factory, or initializer direction instead, such as `BarcodeFormat.Companion.fromFormat(format: Int)` or `BarcodeFormat.from(format:)`.
- Put every Kotlin extension `fun`/`val`/`var` and Swift extension method/property in a separate named extension/converter file with internal/package visibility where possible. Use `Type+operation.kt` names such as `BarcodeFormat+fromMLKitBarcodeFormat.kt` for Kotlin converters. There is no private/tiny/same-file exception for `Hybrid*` files or other implementation files; this keeps code splitting, maintainability, and future review diffs clean.
- A `Hybrid*Factory.kt` or `Hybrid*.swift` file must not contain barcode-format mappings, companion extensions, platform conversion utilities, or other extensions below the implementation.
- Keep `Hybrid*Factory` files as orchestration only: resolve generated options, call validation/preflight helpers, create/start the native session or platform API, and return/reject the Promise. Do not define session/coordinator/delegate classes, native option adapter structs/classes, presenter lookup helpers, builder/config adapters, barcode mappings, permission switches, Info.plist/manifest checks, or capability checks in factory files.
- Split native conversions into one focused extension file per source/target conversion, such as `Barcode+toScannedCode.kt`, `TargetBarcodeFormat+toMLKitFormat.kt`, and `BarcodeFormat+fromMLKitBarcodeFormat.kt`. Do not hide a trivial `map { it.toX() }` behind a concrete collection extension like `Array<TargetBarcodeFormat>.toMLKitFormats()`.
- Extract platform preflight checks out of `Hybrid*` factories and implementation methods. Authorization-status switches, Info.plist/manifest key validation, permission checks, hardware capability checks, and service availability checks belong in focused helper/extension files; the HybridObject call site should read as a short guard or one-line `try`/`check` call.
- Do not replace inline preflight code with a broad `Utils` file. Use small named files such as `Bundle+CameraUsageDescription.swift`, `AVCaptureDevice+CameraAuthorization.swift`, or a focused Android permission/capability helper.
- In Kotlin, annotate Android platform `Int` constants when the platform exposes a matching annotation or `@IntDef`, such as CameraX flash/capture/mirror mode annotations. Place the annotation according to its target on the function, return value, or parameter; verify whether it is a Java or Kotlin annotation before choosing the syntax.
- When converting from an Android annotated `Int`, annotate the `format: Int` parameter on the domain factory/companion function when supported; this gives better IDE and lint feedback than a bare `Int`.
- Validate invalid inputs and required unsupported behavior early. Do not reject cross-platform configuration just because the current native backend ignores an optional preference. If the operation still does its core job, ignore or degrade the preference and report support through capabilities or resolved state.
- Do not silently swallow real failures. Throw, reject a Promise, or emit through an explicit error callback/listener when the requested outcome cannot be delivered.
- Prefer Nitro/runtime errors or language-native exceptions that surface cleanly to JS. Avoid Objective-C-style `NSError` public paths unless the generated API specifically requires it.
- Do not add empty iOS bridging headers such as `Bridge.h` to Nitro Modules. Nitro generates the Swift/C++ bridge it needs. Add Objective-C/Objective-C++ headers only when real handwritten Objective-C code requires them, and include only necessary files in the podspec.
- For Android context access, use `NitroModules.applicationContext` lazily and throw a clear error if it is unavailable.
- Keep Nitro methods synchronous only for quick, deterministic, local work such as cheap object creation, cached metadata, or pure transforms. If the implementation is complex, heavy, fallible over time, native-async already, or crosses a thread/process boundary, make the Nitro API return `Promise<T>`.
- Use the native Promise helper that matches the platform threading model. In Swift, prefer `Promise.parallel(queue)` for DispatchQueue-owned work such as AVFoundation/session queues, and use `Promise.async` only when wrapping Swift `async`/`await` or Task-based APIs end to end. For UIKit/VisionKit main-thread callback APIs, prefer a manual Promise with direct `DispatchQueue.main.async` at the Nitro entry/callback boundary; do not use `Task { @MainActor in ... }` as a generic main-thread hop.
- Avoid main/UI threads unless the native API requires them. Keep main-thread sections limited to UI/presentation/view mutation and run parsing, conversion, I/O, session negotiation, and CPU work on an owned queue/dispatcher/executor or native async API.
- Avoid manually creating or passing around `Promise<T>` instances. Prefer `Promise.async`, `Promise.parallel`, `Promise.resolved`, and `Promise.rejected` because they complete exactly once through structured control flow. A manual Promise is only justified when bridging a native completion/delegate/callback API that cannot use the helpers; keep it in the smallest scope, do not pass it through arbitrary helpers, and guarantee every path resolves or rejects exactly once.
- Before writing a manual Promise for callback/listener APIs, look for or add a general suspend/async adapter in a focused extension file. On Android, wrap Google `Task<T>` once as `Task+await.kt` with `suspendCancellableCoroutine`, then use `return Promise.async(scope) { task.await() }` in the HybridObject method.
- Do not hand-wire `addOnSuccessListener`/`addOnFailureListener`/`addOnCanceledListener` inside `Hybrid*` methods when a reusable callback-to-suspend adapter can express the API once.
- Never hide a thread hop behind a generated property getter or setter. If native state can only be read or changed on a specific queue/thread, expose an async method, listener/event, or explicit lifecycle operation instead.
- Avoid chains of `Task`, `DispatchQueue`, coroutine dispatcher, executor, and JS/Nitro runtime hops inside one operation. Pick a native owner queue/thread/dispatcher for each HybridObject or session and cross into it once at the Promise, lifecycle, or callback boundary. Repeated hops are a sign the HybridObject boundaries or lifecycle handles are wrong.
- Never fix Nitro lifecycle, readiness, or race bugs with `setTimeout`, sleeps, artificial delays, extra thread hops, or calling native methods twice. Model readiness with a Promise, listener/event, returned configured HybridObject, explicit state transition, or native completion callback. Use retries only for external hardware, OS service, remote service, or network uncertainty, with bounded/cancellable/idempotent behavior.
- Implement `memorySize` for HybridObjects that own native resources or large allocations so the JS VM can collect them under memory pressure.
- For Nitro Views, implement `prepareForRecycle` when the view owns state that should be reset before reuse. See [spec-hybrid-view.md][spec-hybrid-view] for the full view spec, implementation, registration, and recycling workflow.
- Mix C++ HybridObjects with Swift/Kotlin HybridObjects in one library. Use C++ for shared or hot code, such as OpenCV/frame processing/storage engines, and Swift/Kotlin for platform services, permissions, file paths, camera/session APIs, and OS integration.
- C++ HybridObjects can accept Swift/Kotlin-implemented HybridObjects and call their generated C++ spec API. Example: a C++ `StorageFactory` can accept a Swift/Kotlin `PlatformContext` and call `getTemporaryDirectory()` or `writeFile(...)` through the generated C++ interface. C++ can access only the public spec API, not private Swift/Kotlin fields.
- Do not rely on Swift/Kotlin calling into C++-implemented HybridObjects unless current Nitrogen support has been verified for that direction.

## Nitro Testing Rules

- Prefer behavior tests over type-shape tests. Nitrogen already enforces specs at compile time, so tests should cover real feature behavior, inputs, settings, failure paths, and order-of-execution cases.
- Use `react-native-harness` when available for end-to-end testing in a real React Native environment. For native-heavy libraries, prefer real-device or CI device-farm coverage for the API surface that depends on hardware or OS behavior.
- In GitHub Actions, prefer harness E2E jobs over standalone native unit tests for APIs that are only public through React Native. Add Kotlin JUnit, XCTest, or other native-only tests only when the package has a native target usable outside React Native or RN harness coverage cannot exercise the behavior.

## Ask First — Before Doing Anything

**First, determine what the user wants to do:**

> "Are you creating a **new Nitro Module library** from scratch, or adding a **new HybridObject** to an existing library?"

---

### If creating a new library — ask all of these before any command:

1. **Library name** — What should the library be called? (e.g. `react-native-math`)
2. **Monorepo with `packages/` folder** — Should the library live in `packages/<name>` inside a monorepo? *(Strongly recommended — default: yes)*
3. **Example app** — Should an example app be created to test the module, and where should it live? *(Recommended — default: yes; `apps/example` when multiple examples are needed or likely, `example` only for a small single-example repo that should stay close to generated RN config)*
4. **Native languages** — Which platforms and languages?
   - iOS: `swift` (default) or `cpp`
   - Android: `kotlin` (default) or `cpp`
   - Cross-platform C++ only: both `cpp`
5. **Module purpose** — Briefly describe what the module does so the correct spec methods can be designed

Do not proceed past Step 1 of the build sequence until all five questions are answered.

### If adding a HybridObject to an existing library — ask only:

1. **HybridObject name** — What should the new HybridObject be called? (e.g. `Camera`, `Crypto`)
2. **Native languages** — iOS: `swift` or `cpp`? Android: `kotlin` or `cpp`?
3. **Purpose** — What does this HybridObject do?

Then skip directly to [spec-hybrid-object.md][spec-hybrid-object] (write the spec), [spec-nitro-json.md][spec-nitro-json] (add autolinking entry), [native-nitrogen-codegen.md][native-nitrogen-codegen] (re-run nitrogen), and the relevant native implementation file. Skip all setup, monorepo, and example app steps.

If the new HybridObject is a **renderable view component**, use [spec-hybrid-view.md][spec-hybrid-view] instead of the plain HybridObject spec reference — it covers the `HybridView` spec, native `view` implementation, Android view manager registration, and the `getHostComponent` JS wiring.

## Typical Build Sequence

```bash
# 0. Work on a separate branch; open a draft PR after the first useful commit

# 1. Scaffold
bunx nitrogen@latest init react-native-math

# 2. Run codegen (from package folder after writing spec + nitro.json)
cd packages/react-native-math && bunx nitrogen

# 3. Create example app
bunx @react-native-community/cli@latest init --skip-install MathExample
mkdir -p apps && mv MathExample apps/example
# Alternative: mv MathExample example

# 4. Install and test
cd apps/example && bun add ../../packages/react-native-math
bun add react-native-nitro-modules@<same-version-as-package>
bun example android
bun example ios
```

Full step-by-step references below.

## When to Apply

Reference these guidelines when:
- Creating any new React Native native module using the Nitro framework
- Checking Nitro minimum platform requirements
- Verifying current Nitro, React Native, and native-toolchain requirements before making implementation decisions
- Designing or reviewing the public API shape of a Nitro-backed library
- Deciding whether an API should be static, instance-based, sync, async, callback-based, or resource-backed
- Writing HybridObject TypeScript specs (`*.nitro.ts` files)
- Running Nitrogen codegen and implementing generated interfaces
- Setting up a monorepo example app for a Nitro library
- Choosing repository layout, root cleanliness, shared config placement, and CI shape
- Establishing branch, draft PR, and squash-merge workflow for a Nitro library
- Configuring Android Gradle paths for a monorepo structure
- Debugging autolinking failures or missing generated files
- Preparing a Nitro module package for npm publishing
- Setting up one-command releases with `release-it` and `bun release`

## Priority-Ordered Guidelines

| Priority | Category | Impact | Reference |
|----------|----------|--------|-----------|
| 0 | General public API shape | CRITICAL | `api-design` |
| 0 | Nitro API constraints | CRITICAL | This SKILL.md |
| 1 | Repo structure and workflow | HIGH | [repo-structure-and-workflow.md][repo-structure-and-workflow] |
| 2 | Nitrogen scaffold | CRITICAL | [setup-monorepo-init.md][setup-monorepo-init] |
| 3 | HybridObject spec | CRITICAL | [spec-hybrid-object.md][spec-hybrid-object] |
| 3 | Hybrid View components *(if building a view)* | HIGH | [spec-hybrid-view.md][spec-hybrid-view] |
| 4 | nitro.json autolinking | CRITICAL | [spec-nitro-json.md][spec-nitro-json] |
| 5 | Nitrogen codegen | HIGH | [native-nitrogen-codegen.md][native-nitrogen-codegen] |
| 6 | C++ implementation | HIGH | [native-implement-cpp.md][native-implement-cpp] |
| 7 | Kotlin implementation | HIGH | [native-implement-kotlin.md][native-implement-kotlin] |
| 8 | Swift implementation | HIGH | [native-implement-swift.md][native-implement-swift] |
| 9 | Example app setup *(if requested)* | HIGH | [example-app-setup.md][example-app-setup] |
| 10 | Android Gradle paths *(if example app)* | HIGH | [example-android-config.md][example-android-config] |
| 11 | Metro + install + test *(if example app)* | HIGH | [example-metro-install.md][example-metro-install] |
| 12 | npm publish readiness | MEDIUM | [spec-package-publish.md][spec-package-publish] |
| 13 | release-it publishing | MEDIUM | [release-it-publishing.md][release-it-publishing] |
| 14 | VisionCamera-style full library patterns | MEDIUM | [vision-camera-golden-standard.md][vision-camera-golden-standard] |

## Quick Reference

### Minimum HybridObject Spec (`src/specs/Math.nitro.ts`)

```typescript
import type { HybridObject } from 'react-native-nitro-modules'

export interface Math extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  add(a: number, b: number): number
}
```

### Minimum Runtime + Type Exports (`src/index.ts`)

```typescript
import { NitroModules } from 'react-native-nitro-modules'
import type { Math } from './specs/Math.nitro'

export const math = NitroModules.createHybridObject<Math>('Math')
export type { Math } from './specs/Math.nitro'
```

Package entry points such as `src/index.ts`, `index.ts`, `index.js`, and `index.tsx` must stay barrels. They may contain direct re-exports and a one-line Nitro root export such as `export const camera = NitroModules.createHybridObject<Camera>('Camera')`, but no actual implementation logic, functions, classes, hooks, components, branching, side effects, or helper definitions. Move real definitions to focused files and re-export them.

For JS/TS source in Nitro packages, keep absence and mutation explicit: never use `void 0` instead of `undefined`, and never use logical assignment operators such as `??=`, `||=`, or `&&=`. Prefer an explicit `if` block or direct assignment that makes fallback behavior visible.

### Minimum `nitro.json`

```json
{
  "$schema": "https://nitro.margelo.com/nitro.schema.json",
  "cxxNamespace": ["math"],
  "ios": { "iosModuleName": "NitroMath" },
  "android": {
    "androidNamespace": ["math"],
    "androidCxxLibName": "NitroMath"
  },
  "autolinking": {
    "Math": {
      "ios": {
        "language": "swift",
        "implementationClassName": "HybridMath"
      },
      "android": {
        "language": "kotlin",
        "implementationClassName": "HybridMath"
      }
    }
  }
}
```

### Root `package.json` Scripts

```json
{
  "scripts": {
    "specs": "bun --cwd packages/react-native-math run specs",
    "example": "bun --cwd apps/example"
  }
}
```

Run: `bun example android`, `bun example ios`, `bun specs`

## References

| File | Description |
|------|-------------|
| [repo-structure-and-workflow.md][repo-structure-and-workflow] | Root layout, README/docs, packages/apps/config/scripts, CI, branch, draft PR, and squash-merge workflow |
| [setup-monorepo-init.md][setup-monorepo-init] | Collecting scaffold inputs and running `nitrogen init` |
| [spec-hybrid-object.md][spec-hybrid-object] | Writing `*.nitro.ts` specs and exporting HybridObjects |
| [spec-hybrid-view.md][spec-hybrid-view] | Building Nitro View components: `HybridView` specs, native views, `getHostComponent`, `hybridRef`, callbacks, recycling |
| [spec-nitro-json.md][spec-nitro-json] | `nitro.json` all fields, autolinking, namespace configuration |
| [native-nitrogen-codegen.md][native-nitrogen-codegen] | Running Nitrogen and verifying generated files |
| [native-implement-cpp.md][native-implement-cpp] | Implementing HybridObjects in C++ |
| [native-implement-kotlin.md][native-implement-kotlin] | Implementing HybridObjects in Kotlin (Android) |
| [native-implement-swift.md][native-implement-swift] | Implementing HybridObjects in Swift (iOS) |
| [example-app-setup.md][example-app-setup] | RN CLI example app init, workspace wiring, version alignment |
| [example-android-config.md][example-android-config] | `settings.gradle` and `build.gradle` monorepo path fixes |
| [example-metro-install.md][example-metro-install] | Metro watchFolders, library install, App.tsx usage, test runs |
| [spec-package-publish.md][spec-package-publish] | `package.json` author, `files` field, and npm publish readiness |
| [release-it-publishing.md][release-it-publishing] | One-command releases with `release-it` and `bun release` |
| [vision-camera-golden-standard.md][vision-camera-golden-standard] | Package layout, API layering, Nitro object modeling, and publishing patterns inspired by VisionCamera |

## Problem → Skill Mapping

| Problem | Reference | Action |
|---------|-----------|--------|
| Need to design the public API first | `api-design` + this SKILL.md | Shape the TS/React API, then apply Nitro constraints |
| Need latest general APIs | `api-design` | Check official docs, release notes, source repos, package metadata, or `llms-full.txt` before deciding |
| Need a recommended repo structure | [repo-structure-and-workflow.md][repo-structure-and-workflow] | Use `main`, a strong README, `packages/`, `apps/` or `example/`, optional Fumadocs, `scripts/`, `config/`, and `.github/workflows/` |
| Unsure static module vs instance API | This SKILL.md | Prefer HybridObjects for native state, resources, prewarming, and zero-copy data |
| Don't know where to start | [setup-monorepo-init.md][setup-monorepo-init] | Scaffold with `nitrogen init` |
| Spec file syntax error | [spec-hybrid-object.md][spec-hybrid-object] | Fix `*.nitro.ts` interface |
| Need a native view component | [spec-hybrid-view.md][spec-hybrid-view] | Write a `HybridView` spec, implement `view`, register the Android manager, wire `getHostComponent` |
| View callback prop arrives as `true` / never fires | [spec-hybrid-view.md][spec-hybrid-view] | Wrap every function prop (including `hybridRef`) with `callback(...)` |
| Android "view manager not found" for a Nitro View | [spec-hybrid-view.md][spec-hybrid-view] | Add the generated `Hybrid*ViewManager` in `createViewManagers` |
| Autolinking not working | [spec-nitro-json.md][spec-nitro-json] | Check `nitro.json` autolinking block |
| Nitrogen generates no files | [native-nitrogen-codegen.md][native-nitrogen-codegen] | Verify spec file extension and run command from right dir |
| C++ types unclear | [native-implement-cpp.md][native-implement-cpp] | Follow type reference links to canonical examples |
| Kotlin compilation error | [native-implement-kotlin.md][native-implement-kotlin] | Check annotations and `override` modifiers |
| Swift compilation error | [native-implement-swift.md][native-implement-swift] | Check class inheritance and property signatures |
| Example app won't build (Android) | [example-android-config.md][example-android-config] | Fix Gradle monorepo path configuration |
| Metro can't resolve library | [example-metro-install.md][example-metro-install] | Add `watchFolders` to `metro.config.js` |
| Version mismatch between example and package | [example-app-setup.md][example-app-setup] | Align `react-native` versions across workspaces |
| Package missing files on npm | [spec-package-publish.md][spec-package-publish] | Fix `files` field in `package.json` |
| Need one-command releases | [release-it-publishing.md][release-it-publishing] | Configure `release-it` behind `bun release` |
| Need a full-featured library structure | [vision-camera-golden-standard.md][vision-camera-golden-standard] | Use the VisionCamera-inspired package, API, hooks, views, and Nitro object model |

[repo-structure-and-workflow]: references/repo-structure-and-workflow.md
[setup-monorepo-init]: references/setup-monorepo-init.md
[spec-hybrid-object]: references/spec-hybrid-object.md
[spec-hybrid-view]: references/spec-hybrid-view.md
[spec-nitro-json]: references/spec-nitro-json.md
[native-nitrogen-codegen]: references/native-nitrogen-codegen.md
[native-implement-cpp]: references/native-implement-cpp.md
[native-implement-kotlin]: references/native-implement-kotlin.md
[native-implement-swift]: references/native-implement-swift.md
[example-app-setup]: references/example-app-setup.md
[example-android-config]: references/example-android-config.md
[example-metro-install]: references/example-metro-install.md
[spec-package-publish]: references/spec-package-publish.md
[release-it-publishing]: references/release-it-publishing.md
[vision-camera-golden-standard]: references/vision-camera-golden-standard.md
