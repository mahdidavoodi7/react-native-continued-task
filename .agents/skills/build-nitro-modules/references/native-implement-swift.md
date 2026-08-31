---
title: Implementing HybridObjects in Swift
impact: HIGH
tags: swift, ios, hybrid-object, native, implementation, NitroModules, protocol, class
---

# Skill: Implementing HybridObjects in Swift

Covers Steps 8–9 (Swift path): creating the Swift implementation class that implements the Nitrogen-generated iOS spec protocol/base typealias.

## Quick Pattern

**Incorrect** — subclassing NSObject directly:
```swift
import Foundation
class HybridMath: NSObject {
  func add(a: Double, b: Double) -> Double { a + b }
}
```

**Correct** — implementing the generated spec:
```swift
import Foundation
import NitroModules

final class HybridMath: HybridMathSpec {
  func add(a: Double, b: Double) throws -> Double { a + b }
}
```

## When to Use

- Implementing the iOS side of a Nitro module in Swift
- When the spec uses `{ ios: 'swift' }`
- After Nitrogen has generated `HybridMathSpec.swift`

## Prerequisites

- Nitrogen has generated `HybridMathSpec.swift`, usually in `nitrogen/generated/ios/swift/`
- `nitro.json` has an iOS autolinking entry with `"language": "swift"` and `"implementationClassName": "HybridMath"`
- `react-native-nitro-modules` is a pod dependency

## Step-by-Step

### 1. Locate the generated spec

```
nitrogen/generated/ios/swift/HybridMathSpec.swift   ← generated protocol/base spec
```

### 2. Create the implementation file

```bash
touch ios/HybridMath.swift
```

### 3. Write the implementation class

```swift
import Foundation
import NitroModules

final class HybridMath: HybridMathSpec {
  private static let queue = DispatchQueue(label: "com.margelo.math")

  // Synchronous methods — most generated methods have `throws`
  func add(a: Double, b: Double) throws -> Double {
    return a + b
  }

  func subtract(a: Double, b: Double) throws -> Double {
    return a - b
  }

  // Async method returning Promise — also has `throws`
  func calculateFibonacci(n: Double) throws -> Promise<Double> {
    return Promise.parallel(Self.queue) {
      if n <= 1 { return n }

      var previous = 0.0
      var current = 1.0
      for _ in 2...Int(n) {
        let next = previous + current
        previous = current
        current = next
      }
      return current
    }
  }

  // Readonly property
  var pi: Double { Double.pi }

  // Read-write property
  var precision: Double = 6.0
}
```

### 4. Add to the podspec

In the package podspec, ensure the implementation file and generated files are included. Current Nitro templates usually do this through `add_nitrogen_files(s)`:

```ruby
load 'nitrogen/generated/ios/NitroMath+autolinking.rb'
add_nitrogen_files(s)
```

If the podspec manually lists source files, include `ios/**/*.{h,m,mm,swift}`, `nitrogen/generated/ios/**/*.{h,hpp,cpp,mm,swift}`, and any shared `cpp/**/*.{hpp,cpp}` files.

### 5. Verify using canonical Swift reference

For any type uncertainty, consult the canonical Swift test implementation:
[HybridTestObjectSwift.swift](https://github.com/mrousavy/nitro/blob/main/packages/react-native-nitro-test/ios/HybridTestObjectSwift.swift)

## Code Examples

### Type reference table

| TypeScript | Swift Type | Notes |
|-----------|-----------|-------|
| `number` | `Double` | Always `Double` |
| `string` | `String` | |
| `boolean` | `Bool` | |
| `bigint` (signed) | `Int64` | |
| `bigint` (unsigned) | `UInt64` | |
| `T[]` | `[T]` | e.g. `[Double]`, `[String]`, `[Person]` |
| `Promise<T>` | `Promise<T>` | `Promise.parallel(queue) { }`, `Promise.async { }`, `Promise.resolved(withResult:)`, or manual `Promise()` |
| `Promise<void>` | `Promise<Void>` | Swift `Void`, not `Unit` |
| `T \| undefined` | `T?` | Swift optional |
| `T \| U` | `Variant_T_U` | Generated type, e.g. `Variant_String_Double` |
| `(x: T) -> void` | `@escaping (T) -> Void` | Must be `@escaping` for stored callbacks |
| `() -> T` | `@escaping () -> T` | |
| `ArrayBuffer` | `ArrayBuffer` | From NitroModules |
| `AnyMap` | `AnyMap` | From NitroModules |
| `Record<string, T>` | `[String: T]` | Swift dictionary literal syntax |
| `HybridObject` | `any HybridSpec` | Protocol existential, e.g. `any HybridMathSpec` |
| `null` / `NullType` | `NullType` | `.null` value |
| `Date` | `Date` | Foundation `Date` |

### Async with Promise

Choose one concurrency model for the feature before implementing it.

- Keep quick, deterministic, local work synchronous. Do not introduce `Promise`, `Task`, or `DispatchQueue` for simple value construction, cached metadata, or pure transforms.
- Use `Promise.parallel(queue)` for DispatchQueue-owned work. This fits most AVFoundation and session-style APIs because you can keep all native state mutations on one queue.
- Use `Promise.async` only when the operation is naturally Swift `async`/`await` or Task-based from end to end.
- Avoid `.main` unless the Apple API requires it, such as UIKit/AppKit/VisionKit presentation or view mutation. Keep main-thread blocks small and move parsing, conversion, I/O, session negotiation, and CPU work to an owned queue or async API.
- Avoid `let promise = Promise<T>()` by default. Prefer `Promise.parallel(queue)`, `Promise.async`, `Promise.resolved`, or `Promise.rejected` so the helper owns exactly-once completion. A manual Promise is only justified when bridging a native completion/delegate/callback API; keep it near the bridge, do not pass it through arbitrary helpers or session objects, and make every branch resolve or reject exactly once.
- Treat repeated `Task`, `DispatchQueue`, actor, or JS/Nitro thread hops as an architecture smell. A HybridObject/session should own the queue/actor it works on, or cross into that owner once at the Promise, lifecycle, or native callback boundary.
- If an operation bounces between main, background, JS, and native queues in multiple nested places, redesign the HybridObject boundary or returned lifecycle handle instead of adding more hops.
- Do not fix lifecycle, readiness, or race bugs with `DispatchQueue.asyncAfter`, `Task.sleep`, `Thread.sleep`, timers, extra queue hops, or calling the same native method twice. Use an explicit Promise, delegate callback, listener event, returned configured HybridObject, or state transition instead. Retry only for external hardware, OS service, remote service, or network uncertainty, with bounded/cancellable/idempotent behavior.
- Do not use `Task { @MainActor in ... }` as a generic main-thread hop from a generated Nitro method. For UIKit/VisionKit callback and delegate APIs, use a manual Promise plus direct `DispatchQueue.main.async` at the Nitro entry or callback boundary.
- Direct `DispatchQueue.main.async` closures are recognized by Swift's actor checker for `@MainActor` calls; generic queue wrappers such as `Promise.parallel(.main)` usually are not unless their closure is explicitly typed as `@MainActor`.
- If an Apple completion can return on an arbitrary queue, normalize that completion to the chosen owner queue once, close to the callback source, instead of nesting repeated main-thread hops through the workflow.
- Do not mix Swift concurrency with `DispatchQueue.sync`, `DispatchQueue.main.sync`, `MainActor.assumeIsolated`, or `Thread.isMainThread` workarounds. If those seem necessary, use a queue-based design or change the public API boundary.
- Never call `DispatchQueue.sync` or `DispatchQueue.main.sync` in Nitro implementation code. This is especially dangerous in generated property getters and setters because those are synchronous JS entry points.

```swift
private static let cameraQueue = DispatchQueue(label: "com.margelo.camera.session")

func calculateFibonacciAsync(value: Double) throws -> Promise<Int64> {
  return Promise.parallel(Self.cameraQueue) {
    return try self.calculateFibonacciSync(value: value)
  }
}
```

Use `Promise.async` when you are intentionally wrapping Swift `async`/`await` or an API that naturally runs through `Task`.

```swift
func loadRemoteImage(url: URL) throws -> Promise<Data> {
  return Promise.async {
    let request = URLRequest(url: url)
    let result = try await URLSession.shared.data(for: request)
    return result.0
  }
}

// Promise<Void> — void async (Swift uses Void not Unit)
func wait(seconds: Double) throws -> Promise<Void> {
  return Promise.async {
    let secondsUInt64 = UInt64(seconds)
    let nanoseconds = secondsUInt64 * 1_000_000_000
    try await Task.sleep(nanoseconds: nanoseconds)
  }
}

// Promise.resolved — instant resolution with a value
func promiseReturnsInstantly() throws -> Promise<Double> {
  return Promise.resolved(withResult: 55.0)
}

// Promise.resolved() — instant void resolution
func promiseThatResolvesVoidInstantly() throws -> Promise<Void> {
  return Promise.resolved()
}

// Promise<T?> — resolves to undefined/nil
func promiseThatResolvesToUndefined() throws -> Promise<Double?> {
  return Promise.resolved(withResult: nil)
}
```

### Threading and state

HybridObject methods and property access can be called synchronously from JS, including from multiple JS runtimes such as worklets. Do not model HybridObject implementations as Swift `actor`s by default; actors make sync generated methods awkward and can hide where serialization happens.

Prefer one of these patterns:
- Keep cheap readonly state synchronous.
- Put mutable native/session state behind a private serial `DispatchQueue`, and run mutating or fallible operations through `Promise.parallel(queue)`.
- Make operations async when they must serialize, wait for hardware/session state, or cross queues.
- Emit listener events from the queue/thread that owns the state when callers need ongoing observations.
- Treat locks as a last-resort synchronization primitive, not a default safety wrapper. Before adding `NSLock`, identify the concrete shared mutable values, the threads/queues that can access them concurrently, and why ownership by `MainActor`, a serial queue, a Nitro runtime/thread, or immutable snapshots is not enough.
- Listener registries should usually be owned by the same queue/thread that emits their events. If Nitro add/remove calls can genuinely race with native delegate callbacks, use a tiny lock only around dictionary mutation and snapshot creation.
- Never invoke JS/Nitro callbacks while holding a lock. Snapshot listeners, unlock, then call them. A listener removed during an in-flight emission may receive that current event; cleanup only needs to prevent future emissions.

### Using callbacks

```swift
func compute(input: Double, onResult: @escaping (Double) -> Void) {
  let result = input * 2.0
  onResult(result)
}
```

### Handling optional parameters

```swift
var optionalValue: Double? = nil

func round(value: Double, decimals: Double?) -> Double {
  let places = decimals ?? 0
  let multiplier = pow(10.0, places)
  return Foundation.round(value * multiplier) / multiplier
}
```

### Throwing errors

Use `guard` for state/input validation. Throw `RuntimeError` for user-reachable failures. Do not expose `NSError` paths unless a generated API or Apple callback forces it, and convert those errors before they cross into JS.

```swift
func divide(a: Double, b: Double) throws -> Double {
  guard b != 0 else {
    throw RuntimeError("Division by zero!")
  }
  return a / b
}
```

### Validating configuration

Validate invalid values and required behavior early, but do not reject optional cross-platform preferences only because iOS ignores them. If the operation still does its core job, ignore or degrade the preference and report support through the public capabilities or resolved state.

Examples:
- Throw when a requested flash mode cannot work because the device has no flash.
- Do not throw only because a quality, guidance UI, high-frame-rate, auto-zoom, or region preference is unsupported, unless the API documents that field as a hard requirement.

### Properties and thread affinity

```swift
private var _zoom: Double = 1.0

var zoom: Double {
  get { _zoom }
  set {
    _zoom = newValue
  }
}
```

Writable properties are synchronous JS calls. Keep getters and setters cheap, local, and unlikely to fail. If applying a value requires queue hops, AVFoundation negotiation, permissions, allocation, or can fail, expose a method that returns `Promise<Void>` instead.

```swift
// Avoid: synchronous queue hop hidden in a getter.
var status: SessionStatus {
  queue.sync { session.status }
}

// Prefer: make the queue boundary explicit.
func getStatus() throws -> Promise<SessionStatus> {
  return Promise.parallel(Self.cameraQueue) {
    return self.session.status
  }
}

func setZoom(_ zoom: Double) throws -> Promise<Void> {
  return Promise.parallel(Self.cameraQueue) {
    try self.applyZoomToCamera(zoom)
  }
}
```

If state can only be observed on a specific queue, prefer a listener or event API emitted from that queue instead of a getter.

### Swift style and organization

- Make HybridObject implementation classes `final` unless inheritance is genuinely required.
- Use Swift types such as `String`, `[String: T]`, arrays, structs, and typed Foundation values. Avoid Objective-C bridge types such as `NSString`, `NSDictionary`, `NSArray`, and `NSObject` inheritance unless an Apple API requires them.
- Treat `ios/HybridDataScanner.swift` as the implementation file for `HybridDataScanner`, not as a dumping ground for Swift extensions, UI helpers, geometry conversions, delegates, or native protocols.
- Keep exactly one top-level implementation type per file. `HybridDataScannerFactory.swift` contains `HybridDataScannerFactory` and no other structs, classes, enums, protocols, option adapters, coordinators, delegates, scanner sessions, or helper types.
- Put reusable conversions, Apple framework helpers, and small protocol conveniences in focused Swift extension files under `ios/Extensions/`, such as `ios/Extensions/UIViewController+topPresentedViewController.swift`, `ios/Extensions/CGPoint+Point.swift`, `ios/Extensions/Barcode+toScannedCode.swift`, or `ios/Extensions/AVFoundation/AVCaptureDevice+withLock.swift`.
- Never put Swift extensions inside `Hybrid*` implementation files or other primary implementation files, even when the extension is private, tiny, or only used by that file. Put every extension in a separate named `Type+operation.swift` extension/converter file so code splitting, maintainability, and future diffs stay clean.
- Move delegates, framework adapters, converters, native protocols, and helper state into separate named files. Use `internal` or `package` visibility when the helper should not be public API.
- Keep `Hybrid*Factory.swift` as orchestration only: resolve generated options, call validation/preflight helpers, create/start the native session, and return/reject the Promise. Do not define `Native*Options` structs, session/coordinator/delegate classes, presenter traversal helpers, Vision/VisionKit barcode mappings, scanner configuration builders, permission switches, Info.plist checks, or availability checks in the factory file.
- Extract platform preflight checks out of `Hybrid*` factories and implementation methods. `AVCaptureDevice.authorizationStatus(...)` switches, `Bundle.main.object(forInfoDictionaryKey: "NSCameraUsageDescription")` guards, hardware support checks, and similar setup validation belong in focused helper/extension files such as `AVCaptureDevice+CameraAuthorization.swift` or `Bundle+CameraUsageDescription.swift`. The factory should call those helpers in one or two readable lines.
- Do not create broad `Utils.swift` files for preflight checks. Use small files named after the platform type or domain check, and keep each file focused on one behavior.
- Use line count as a review signal: under roughly 300 lines is usually acceptable only after the one-type-per-file and no-helpers-in-factory rules are satisfied. A large file caused by extension methods, helper variables, or platform glue belongs in multiple files.
- Prefer inline shorthand for unambiguous single-expression closures: `targetFormats.flatMap { $0.toVNBarcodeFormat() }`, not a multi-line `flatMap { format in format.toVNBarcodeFormat() }`. Do not use `$0` when a surrounding or nested closure already uses shorthand arguments; name parameters in nested closures or when clarity needs it.
- Put one-element conversions on the source type. A Vision conversion should live in a file such as `ios/Extensions/RecognizedDataType+DataScannerRecognizedDataType.swift`; it can return `[DataScannerViewController.RecognizedDataType]` or `Set<DataScannerViewController.RecognizedDataType>` when one source value expands to several native values.
- Do not put domain conversions on broad receivers such as `Int`, `String`, `Double`, `Any`, `CGPoint`, or `CGRect` unless the conversion is genuinely about that type. Prefer the domain type direction, such as `BarcodeFormat.from(format:)` or `BarcodeFormat(nativeFormat:)`, over `Int.toBarcodeFormat()`.
- Compose collections where they are used, for example `Set(try dataTypes.flatMap { try $0.toVisionRecognizedDataTypes() })`. Keep an aggregate helper only when it owns real collection semantics such as deduplication, validation across elements, nonempty checks, batching, caching, or error aggregation, and place it in a focused conversion/configuration file rather than `HybridDataScanner.swift`.
- Break complex expressions into named intermediate values. Avoid inline chains that allocate, convert units, and call another API in one expression.
- Pass named constants or variables into API calls instead of building values inline when the expression has meaningful steps.

```swift
let radians = angleDegrees * .pi / 180.0
let rotatedPoint = point.rotated(by: radians)
let projectedPoint = projection.project(rotatedPoint)
renderer.render(point: projectedPoint)
```

## Common Pitfalls

- **Forgetting `import NitroModules`** — The spec protocol won't be found without this import
- **Subclassing `NSObject` instead of the spec** — `class HybridMath: NSObject` won't satisfy the generated protocol
- **Method signature mismatch** — Every parameter name and type must exactly match the generated spec
- **Forgetting `throws` keyword** — Most generated methods have `throws`; check the generated spec to confirm which ones do
- **`Promise<void>` vs `Promise<Void>`** — Swift uses `Void` (not Kotlin's `Unit`). Always `Promise<Void>`
- **Using `Promise.async` for DispatchQueue APIs** — Prefer `Promise.parallel(queue)` for AVFoundation/session work. Use `Promise.async` for Swift `async`/`await` or Task-based APIs.
- **Using `DispatchQueue.sync` or `DispatchQueue.main.sync`** — Treat synchronous queue hops as a design bug. Make the Nitro API async or event-based instead.
- **Mixing actors and queues with escape hatches** — Do not use `MainActor.assumeIsolated`, `Thread.isMainThread`, or queue sync calls to force an async/await design onto queue-owned APIs.
- **Callbacks without `@escaping`** — Stored/async callbacks must be `@escaping`; the generated spec will tell you
- **`Dictionary<String,T>` vs `[String:T]`** — Both work; `[String:T]` is the idiomatic Swift syntax
- **`any HybridSpec` not `HybridSpec`** — In modern Swift, protocol types need the `any` keyword
- **Not including the file in podspec** — Swift files must be in the `source_files` glob in `.podspec`
- **Using the `override` keyword** — Swift implementations conform to the generated spec shape; methods and properties declared by the spec must NOT use `override` (unlike the Kotlin counterpart, which does). `override` only applies when overriding a superclass member.
- **Defaulting HybridObjects to `actor`** — JS-facing methods and properties are synchronous entry points. Prefer queue-owned state and async methods where serialization is needed.
- **Leaking Objective-C types** — Avoid `NSDictionary`, `NSString`, `NSArray`, and `NSError` in Nitro implementation APIs unless required by an Apple API boundary.
- **Letting one HybridObject file absorb every helper** — Split extensions, delegates, converters, and protocols into named files. `Hybrid*` implementation files must not contain extensions at all, even private ones.
- **Inlining platform preflight logic in factories** — Do not bury authorization switches, Info.plist checks, or hardware capability guards inside `Hybrid*Factory` methods. Put them in focused helper/extension files and keep the caller short.
- **Turning factories into native implementation dumps** — Do not place `Native*Options`, session/coordinator/delegate classes, presenter lookup, Vision/VisionKit mappings, scanner builders, or availability checks below `Hybrid*Factory`. The factory should orchestrate named helpers from separate files.
- **Putting multiple top-level types in one file** — Native implementation files should contain one top-level type. Move helper structs, classes, enums, protocols, delegates, sessions, and option adapters into their own files.
- **Expanding single-expression closures** — Keep simple maps/flatMaps inline with `$0`, such as `targetFormats.flatMap { $0.toVNBarcodeFormat() }`, unless the closure is nested or shorthand would be ambiguous.
- **Extending primitive/common types for domain conversions** — Do not add helpers like `Int.toBarcodeFormat()`. Put the factory/converter on the domain type with a static method or initializer.
- **Putting trivial maps behind collection extensions** — Prefer an element conversion plus `map`/`flatMap` at the call site. A collection helper is justified only when the collection itself adds behavior such as deduplication or validation.

## Related Skills

- [swift](../../swift/SKILL.md) — General Swift API, concurrency, and threading guidance
- [native-nitrogen-codegen.md](native-nitrogen-codegen.md) — Must generate specs before implementing
- [spec-nitro-json.md](spec-nitro-json.md) — Configure `"swift"` in autolinking
- [native-implement-kotlin.md](native-implement-kotlin.md) — Android Kotlin counterpart
- [native-implement-cpp.md](native-implement-cpp.md) — C++ cross-platform alternative
