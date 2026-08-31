---
title: Implementing HybridObjects in Kotlin
impact: HIGH
tags: kotlin, android, hybrid-object, native, implementation, annotations, Keep, DoNotStrip, Promise
---

# Skill: Implementing HybridObjects in Kotlin

Covers Steps 8–9 (Kotlin path): creating the Kotlin implementation class that extends the Nitrogen-generated Android spec.

## Quick Pattern

**Incorrect** — missing required annotations:
```kotlin
class HybridMath : HybridMathSpec() {
  override fun add(a: Double, b: Double) = a + b
}
```

**Correct** — with required annotations:
```kotlin
@Keep
@DoNotStrip
class HybridMath : HybridMathSpec() {
  override fun add(a: Double, b: Double): Double = a + b
}
```

## When to Use

- Implementing the Android side of a Nitro module in Kotlin
- When the spec uses `{ android: 'kotlin' }`
- After Nitrogen has generated `HybridMathSpec.kt`

## Prerequisites

- Nitrogen has generated `HybridMathSpec.kt`, usually in `nitrogen/generated/android/kotlin/com/margelo/nitro/<namespace>/`
- `nitro.json` has an Android autolinking entry with `"language": "kotlin"` and `"implementationClassName": "HybridMath"`

## Step-by-Step

### 1. Locate the generated spec

```
nitrogen/generated/android/kotlin/com/margelo/nitro/math/HybridMathSpec.kt
```

This is the abstract class your implementation must extend. Do not edit it.

### 2. Create the implementation file

```bash
touch android/src/main/java/com/margelo/nitro/math/HybridMath.kt
```

The package must match `androidNamespace` from `nitro.json`.

### 3. Write the implementation class

```kotlin
package com.margelo.nitro.math

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip

@Keep
@DoNotStrip
class HybridMath : HybridMathSpec() {

  // Synchronous method
  override fun add(a: Double, b: Double): Double = a + b

  override fun subtract(a: Double, b: Double): Double = a - b

  // Async method using Promise
  override fun calculateFibonacci(n: Double): Promise<Double> {
    return Promise.async {
      var a = 0.0; var b = 1.0
      for (i in 2..n.toInt()) {
        val temp = a + b; a = b; b = temp
      }
      b
    }
  }

  // Readonly property
  override val pi: Double = Math.PI

  // Read-write property
  override var precision: Double = 6.0
}
```

### 4. Add annotations — this is non-negotiable

- `@Keep` — Prevents ProGuard/R8 from removing the class
- `@DoNotStrip` — Prevents Meta's code stripper from removing it

`@DoNotStrip` is required when ProGuard/R8 can strip the class. Keep `@Keep` as well to match generated Nitro code and common library implementations.

### 5. Verify using canonical Kotlin reference

For any type uncertainty, consult the canonical Kotlin test implementation:
[HybridTestObjectKotlin.kt](https://github.com/mrousavy/nitro/blob/main/packages/react-native-nitro-test/android/src/main/java/com/margelo/nitro/test/HybridTestObjectKotlin.kt)

## Code Examples

### Type reference table

| TypeScript | Kotlin Type | Notes |
|-----------|-------------|-------|
| `number` | `Double` | Always `Double` |
| `string` | `String` | |
| `boolean` | `Boolean` | |
| `bigint` (signed) | `Long` | |
| `bigint` (unsigned) | `ULong` | Critical: `ULong`, not `Long` |
| `number[]` | `DoubleArray` | Primitive array — NOT `Array<Double>` |
| `T[]` (non-number) | `Array<T>` | e.g. `Array<String>`, `Array<Person>` |
| `Promise<T>` | `Promise<T>` | Use `Promise.async { }` or `Promise.parallel { }` |
| `Promise<void>` | `Promise<Unit>` | Kotlin `Unit`, not `Void` |
| `T \| undefined` | `T?` | Kotlin nullable |
| `(x: T) => void` | `(T) -> Unit` | Lambda type, no `@escaping` needed |
| `() => T` | `() -> T` | |
| `ArrayBuffer` | `ArrayBuffer` | From nitro-modules core |
| `AnyMap` | `AnyMap` | From nitro-modules core |
| `Record<string, T>` | `Map<String, T>` | |
| `HybridObject` | `HybridSpec` | Kotlin class, no `shared_ptr` |
| `null` / `NullType` | `NullType` | `NullType.NULL` constant |
| `Date` | `java.time.Instant` | |

### Async with Promise

Use the Promise helper that matches the work:
- Keep quick, deterministic, local work synchronous. Do not introduce `Promise`, coroutines, or dispatchers for simple value construction, cached metadata, or pure transforms.
- `Promise.async` for suspending or I/O work that should run through coroutines.
- `Promise.parallel` for CPU-bound synchronous work that should run off the caller thread.
- Avoid the main dispatcher unless the Android API requires it, such as view/UI mutation or lifecycle APIs. Keep main-thread blocks small and move parsing, conversion, I/O, session negotiation, and CPU work to an owned dispatcher or async API.
- Avoid manually creating or passing around `Promise<T>` instances by default. Prefer `Promise.async`, `Promise.parallel`, `Promise.resolved`, or `Promise.rejected` so the helper owns exactly-once completion. A manual Promise is only justified when a native completion/listener/callback API cannot be wrapped as a suspend API; keep it near the bridge and make every branch resolve or reject exactly once.
- Before writing a manual Promise for callback/listener APIs, look for or add a general suspend adapter in a focused extension file. For Google `Task<T>`, create `Task+await.kt` once and call `return Promise.async(scope) { task.await() }` from the HybridObject method.
- Do not hand-wire `addOnSuccessListener`/`addOnFailureListener`/`addOnCanceledListener` inside public HybridObject methods when a reusable `await()` adapter can express that API once.
- Do not use `runBlocking` in HybridObject methods, generated property getters/setters, or library callbacks. If callers must wait for a result, expose a `Promise<T>` method in the Nitro spec.
- Treat repeated `launch`, `withContext`, dispatcher, handler, executor, or JS/Nitro runtime hops as an architecture smell. A HybridObject/session should own the coroutine scope/dispatcher/lifecycle it works on, or cross into that owner once at the Promise, lifecycle, or native callback boundary.
- If an operation bounces between main, IO, default, native, and JS/Nitro contexts in multiple nested places, redesign the HybridObject boundary or returned lifecycle handle instead of adding more hops.
- Do not fix lifecycle, readiness, or race bugs with `delay`, `Thread.sleep`, `Handler.postDelayed`, timers, extra dispatcher hops, or calling the same native method twice. Use an explicit Promise, callback, listener event, Flow, returned configured HybridObject, or state transition instead. Retry only for external hardware, OS service, remote service, or network uncertainty, with bounded/cancellable/idempotent behavior.
- Treat `Mutex`, `synchronized`, and `ReentrantLock` as last-resort synchronization. Before adding one to a HybridObject, identify the concrete shared mutable values, the threads/dispatchers that can access them concurrently, and why one owner dispatcher/lifecycle, message passing, or immutable snapshots is not enough.
- Never invoke JS/Nitro callbacks while holding a lock. Snapshot listener collections if needed, unlock, then call them. A listener removed during an in-flight emission may receive that current event.

```kotlin
// Promise.async — for IO-bound or suspending work (uses coroutines)
override fun wait(seconds: Double): Promise<Unit> {
  return Promise.async { delay(seconds.toLong() * 1000) }
}

// Promise.parallel — for CPU-bound synchronous work (runs on thread pool)
override fun calculateFibonacciAsync(value: Double): Promise<Long> {
  return Promise.parallel { calculateFibonacciSync(value) }
}

// Promise.resolved — for instantly-resolved values
override fun promiseReturnsInstantly(): Promise<Double> {
  return Promise.resolved(55.0)
}

// Promise.resolved() — for instantly-resolved void
override fun promiseThatResolvesVoidInstantly(): Promise<Unit> {
  return Promise.resolved()
}
```

For Google Tasks, put the generic bridge in `Task+await.kt` rather than wiring listeners in each HybridObject:

```kotlin
import com.google.android.gms.tasks.Task
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

internal suspend fun <T> Task<T>.await(): T {
  return suspendCancellableCoroutine { continuation ->
    addOnSuccessListener { result ->
      if (continuation.isActive) {
        continuation.resume(result)
      }
    }
    addOnFailureListener { error ->
      if (continuation.isActive) {
        continuation.resumeWithException(error)
      }
    }
    addOnCanceledListener {
      if (continuation.isActive) {
        continuation.resumeWithException(RuntimeException("Task was canceled."))
      }
    }
  }
}
```

### Accessing Android Context

Use `NitroModules.applicationContext` to get the `ReactApplicationContext` as it can be accessed anywhere in your hybrid objects. Always access it lazily via a property — never store it in a field, as it can be null during initialization.

```kotlin
import android.content.Context
import android.content.SharedPreferences
import com.margelo.nitro.NitroModules

@Keep
@DoNotStrip
class HybridStorage : HybridStorageSpec() {

  // Lazily access context — throws if not yet set
  private val context: ReactApplicationContext
    get() = NitroModules.applicationContext ?: throw Error("No ApplicationContext set!")

  // Use context to get system services or app storage
  private val sharedPreferences: SharedPreferences
    get() = context.getSharedPreferences("com.margelo.storage", Context.MODE_PRIVATE)

  override fun getString(key: String): String? {
    return sharedPreferences.getString(key, null)
  }

  override fun setString(key: String, value: String) {
    sharedPreferences.edit().putString(key, value).apply()
  }
}
```

**Rules:**
- Always use `get()` — never `val context = NitroModules.applicationContext` at class level, it may be null at construction time
- Always null-check with `?: throw Error(...)` so failures are explicit, not silent NPEs
- `ReactApplicationContext` is a subclass of Android `Context` — use it for `getSharedPreferences`, `getSystemService`, file access, etc.

### Using callbacks

```kotlin
override fun compute(input: Double, onResult: (Double) -> Unit) {
  val result = input * 2.0
  onResult(result)
}
```

### Handling nullable / optional

Use Kotlin nullable types for real domain absence, not for modeling several possible object states. If fields are related, put them on a non-null variant type in the TypeScript spec and the generated Kotlin implementation.

```kotlin
override var optionalValue: Double? = null

override fun processOptional(value: Double?): Double {
  return value ?: 0.0
}
```

For closed Kotlin-only helper state, prefer `sealed interface` or `sealed class` over a data class with many nullable fields.

### Properties and thread affinity

Generated Nitro properties are synchronous JS entry points. Keep `val`/`var` access cheap and local. Do not hide blocking work, `runBlocking`, Android service calls, permission flows, or thread hops in a getter or setter.

```kotlin
// Avoid: blocking async work hidden in a getter.
val status: SessionStatus
  get() = runBlocking { session.status() }

// Prefer: make the async boundary explicit in the Nitro spec.
override fun getStatus(): Promise<SessionStatus> {
  return Promise.async {
    session.status()
  }
}
```

### Throwing errors

```kotlin
override fun divide(a: Double, b: Double): Double {
  if (b == 0.0) throw IllegalArgumentException("Division by zero!")
  return a / b
}
```

### Validating configuration

Validate invalid values and required behavior early, but do not reject optional cross-platform preferences only because Android ignores them. If the operation still does its core job, ignore or degrade the preference and report support through the public capabilities or resolved state.

Examples:
- Throw when a requested flash mode cannot work because the device has no flash.
- Do not throw only because a quality, guidance UI, high-frame-rate, auto-zoom, or region preference is unsupported, unless the API documents that field as a hard requirement.

### Kotlin style and organization

- Treat `HybridDataScanner.kt` as the implementation file for `HybridDataScanner`, not as a dumping ground for Android helpers, geometry conversions, listeners, or extension utilities.
- Prefer explicit `return` statements inside multi-line control flow. Do not lift the return outside a multi-line `try`/`catch`, `if`, `when`, or lambda just to make it expression-like; use `try { return value } catch (...) { return fallback }`.
- In multi-line lambdas, use labeled returns such as `return@map value` for the result. Omit the label only for true single-expression lambdas like `items.map { it.toString() }`.
- Prefer inline shorthand for unambiguous single-expression lambdas: `formats.map { it.toMLKitFormat() }`, not a multi-line `map { format -> format.toMLKitFormat() }`. Do not use `it` when a surrounding or nested lambda already uses `it`; name parameters in nested lambdas or when clarity needs it.
- Keep exactly one top-level implementation type per file. `HybridDataScannerFactory.kt` contains `HybridDataScannerFactory` and no other classes, interfaces, enums, option adapters, coordinators, delegates, scanner sessions, or helper types.
- Keep one focused extension/conversion per file. Do not create a catch-all Kotlin file for every extension in a feature.
- Never put Kotlin extension `fun`, `val`, or `var` declarations inside `Hybrid*` implementation files or other primary implementation files, even when they are private, tiny, or only used by that file. Put every extension in a separate named `Type+operation.kt` extension/converter file so code splitting, maintainability, and future diffs stay clean.
- Move reusable extensions, Android adapters, conversion helpers, delegates/listeners, and protocol-style interfaces into named files such as `Extensions/ViewExtensions.kt`, `Conversions/PointConversions.kt`, `Barcode+toScannedCode.kt`, `TargetBarcodeFormat+toMLKitFormat.kt`, `BarcodeFormat+fromMLKitBarcodeFormat.kt`, or `DataScannerDelegate.kt`.
- Use `internal` visibility for helpers that should stay inside the module.
- Keep `Hybrid*Factory.kt` as orchestration only: resolve generated options, call validation/preflight helpers, build/start the native API, and return/reject the Promise. Do not define ML Kit/CameraX builder adapters, barcode mappings, companion converters, permission checks, manifest checks, capability checks, or scanner/session helper types in the factory file.
- Extract Android preflight checks out of `Hybrid*` factories and implementation methods. Permission checks, manifest feature/permission validation, `PackageManager` capability checks, service availability checks, and similar setup guards belong in focused helper files. The factory should call those helpers in one or two readable lines.
- Do not create broad `Utils.kt` files for preflight checks. Use small files named after the platform type or domain check, and keep each file focused on one behavior.
- Use line count as a review signal: under roughly 300 lines is usually acceptable only after the one-type-per-file and no-helpers-in-factory rules are satisfied. A large file caused by helpers or Android glue belongs in multiple files.
- Put one-element conversions on the source type. The element method may return a list/set when one source value expands to several native values.
- Do not put domain conversions on broad receivers such as `Int`, `String`, `Double`, or `Any`, even as private helpers. Prefer the domain direction, such as `BarcodeFormat.Companion.fromFormat(format: Int)`, over `Int.toBarcodeFormat()`.
- Compose collections where they are used with `map`, `flatMap`, folds, or sets. Prefer `TargetBarcodeFormat.toMLKitFormat()` plus `formats.map { it.toMLKitFormat() }` at the call site over `Array<TargetBarcodeFormat>.toMLKitFormats()`. Keep an aggregate helper only when it owns real collection semantics such as deduplication, validation across elements, nonempty checks, batching, caching, or error aggregation, and place it in a focused conversion/configuration file rather than the main HybridObject file.
- For converters that return or accept Android platform `Int` constants, apply the matching platform annotation when one exists, such as CameraX flash, capture, or mirror mode annotations. Check whether it is a Java `@IntDef` or Kotlin annotation and place it on the function, return value, or parameter according to its supported targets.
- When converting from an annotated platform `Int`, put the annotation on the `format: Int` parameter if the annotation target supports parameters, for example `BarcodeFormat.Companion.fromFormat(@SomeBarcodeFormat format: Int)`.

## Common Pitfalls

- **Missing `@Keep` or `@DoNotStrip`** — The class will be removed in release builds, causing crashes
- **Wrong package name** — Must match `com.margelo.nitro.<androidNamespace>` from `nitro.json`
- **`Long` vs `ULong`** — TypeScript `bigint` with `uint64` maps to `ULong` not `Long`
- **Not overriding all abstract members** — Kotlin will fail to compile if any abstract member is missing
- **`Promise<void>` vs `Promise<Unit>`** — Kotlin uses `Unit`, not `void`. Always `Promise<Unit>` for void async methods
- **`Array<Double>` vs `DoubleArray`** — Number arrays use `DoubleArray` (primitive), other types use `Array<T>`
- **`Promise.async` vs `Promise.parallel`** — Use `async` for IO/coroutine work, `parallel` for CPU-bound sync work
- **Calling blocking code outside `Promise.async`** — Network calls, delay, etc. must be inside `Promise.async { }` (uses coroutines)
- **Hand-wiring callback APIs into manual Promises** — Wrap general callback APIs once as suspend adapters, such as `Task<T>.await()` in `Task+await.kt`, then call them from `Promise.async`.
- **Lifting returns out of multi-line Kotlin control flow** — Prefer explicit returns inside `try`/`catch` branches and labeled returns inside multi-line lambdas. Use implicit lambda results only for true one-line lambdas.
- **Expanding single-expression lambdas** — Keep simple maps/flatMaps inline with `it`, such as `formats.map { it.toMLKitFormat() }`, unless the lambda is nested or shorthand would be ambiguous.
- **Using `runBlocking` in generated entry points** — Do not block JS-facing methods or properties; expose a `Promise<T>` method or listener instead
- **Modeling variants with nullable clusters** — Use distinct TypeScript/Nitro variants so Kotlin receives non-null related fields
- **Storing `NitroModules.applicationContext` in a field** — It can be null at construction time; always access it via a `get()` property
- **Not null-checking `applicationContext`** — Always use `?: throw Error("No ApplicationContext set!")` to fail explicitly
- **Letting one HybridObject file absorb every helper** — Split extensions, adapters, converters, and listeners into named files. `Hybrid*` implementation files must not contain extension `fun`/`val`/`var` declarations at all, even private ones.
- **Inlining platform preflight logic in factories** — Do not bury permission checks, manifest validation, service availability checks, or hardware capability guards inside `Hybrid*Factory` methods. Put them in focused helper files and keep the caller short.
- **Turning factories into native implementation dumps** — Do not place ML Kit/CameraX builder adapters, barcode mapping, companion converters, scanner option adapters, or session helper types below `Hybrid*Factory`. The factory should orchestrate named helpers from separate files.
- **Putting multiple top-level types in one file** — Native implementation files should contain one top-level type. Move helper classes, interfaces, enums, delegates, sessions, and option adapters into their own files.
- **Extending primitive/common types for domain conversions** — Do not add helpers like `Int.toBarcodeFormat()`. Put the factory/converter on the domain type or companion, such as `BarcodeFormat.Companion.fromFormat(format)`.
- **Putting trivial maps behind collection extensions** — Prefer an element conversion plus `map`/`flatMap` at the call site. A collection helper is justified only when the collection itself adds behavior such as deduplication or validation.
- **Returning unannotated Android int constants** — When CameraX/Android exposes an annotation for a mode or format `Int`, use it on converter functions or parameters so callers and tooling see the constrained value space.

## Related Skills

- [kotlin](../../kotlin/SKILL.md) — General Kotlin API, nullability, coroutine, and threading guidance
- [native-nitrogen-codegen.md](native-nitrogen-codegen.md) — Must generate specs before implementing
- [spec-nitro-json.md](spec-nitro-json.md) — Configure `"kotlin"` in autolinking
- [native-implement-swift.md](native-implement-swift.md) — iOS Swift counterpart
- [native-implement-cpp.md](native-implement-cpp.md) — C++ cross-platform alternative
