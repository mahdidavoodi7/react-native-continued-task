---
title: Implementing HybridObjects in C++
impact: HIGH
tags: c++, hybrid-object, native, implementation, cpp, cross-platform, namespace, override
---

# Skill: Implementing HybridObjects in C++

Covers Steps 8–9 (C++ path): creating the C++ implementation class that inherits from the Nitrogen-generated spec.

## Quick Pattern

Implement in a separate file that inherits from the generated spec:
```cpp
// cpp/HybridMath.hpp
#pragma once
#include "HybridMathSpec.hpp"

namespace margelo::nitro::math {
  class HybridMath final : public HybridMathSpec {
  public:
    HybridMath() : HybridObject(TAG) {}
    double add(double a, double b) override;
  };
}
```

## When to Use

- When the spec uses `{ ios: 'cpp'; android: 'cpp' }` (shared C++ implementation)
- When implementing platform-agnostic logic that runs on both iOS and Android
- When performance or code-sharing across platforms is critical
- When C++ code needs to call the public generated spec API of a Swift/Kotlin-implemented HybridObject passed in from TypeScript

## Prerequisites

- Nitrogen has generated `HybridMathSpec.hpp`, usually in `nitrogen/generated/shared/c++/`
- `nitro.json` has `"all": { "language": "c++", "implementationClassName": "HybridMath" }` in the autolinking block

## Mixed-Language Object Graphs

C++ HybridObjects can accept HybridObjects implemented in Swift/Kotlin and call their generated C++ spec API. This lets C++ engines use platform services without hand-written Swift/JNI bridges.

Example spec shape:

```typescript
export interface PlatformContext
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  getTemporaryDirectory(): string
  writeFile(content: ArrayBuffer, path: string): Promise<void>
}

export interface StorageFactory
  extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  createStorage(context: PlatformContext): Storage
}
```

The generated C++ signature for `createStorage(...)` receives the generated C++ spec type for `PlatformContext`. C++ can call public methods like `getTemporaryDirectory()` and `writeFile(...)`; it cannot access private Swift/Kotlin implementation fields.

Use this for C++ OpenCV/frame processing, storage engines, ML/image/audio pipelines, or compression code that needs platform file paths, permissions, OS handles, or persistence implemented in Swift/Kotlin.

Do not assume Swift/Kotlin can directly consume C++-implemented HybridObjects unless current Nitrogen support has been verified for that direction.

## Step-by-Step

### 1. Locate the generated spec

```
nitrogen/generated/shared/c++/HybridMathSpec.hpp   ← abstract base class
```

### 2. Create the implementation header

```bash
touch cpp/HybridMath.hpp
```

```cpp
// cpp/HybridMath.hpp
#pragma once
#include "HybridMathSpec.hpp"

namespace margelo::nitro::math {

  class HybridMath final : public HybridMathSpec {
  public:
    HybridMath() : HybridObject(TAG) {}

  public:
    // Implement all pure virtual methods from the generated spec
    double add(double a, double b) override;
    double subtract(double a, double b) override;
    std::shared_ptr<Promise<double>> calculateFibonacci(double n) override;

    // Properties
    double getPi() override;
    double getPrecision() override;
    void setPrecision(double precision) override;

  private:
    double _precision = 6.0;

  public:
    inline static const char* TAG = "Math";
  };

} // namespace margelo::nitro::math
```

### 3. Create the implementation source file

```bash
touch cpp/HybridMath.cpp
```

```cpp
// cpp/HybridMath.cpp
#include "HybridMath.hpp"

namespace margelo::nitro::math {

  double HybridMath::add(double a, double b) {
    return a + b;
  }

  double HybridMath::subtract(double a, double b) {
    return a - b;
  }

  std::shared_ptr<Promise<double>> HybridMath::calculateFibonacci(double n) {
    return Promise<double>::async([n]() -> double {
      if (n <= 1) return n;
      double a = 0, b = 1;
      for (int i = 2; i <= n; i++) {
        double temp = a + b;
        a = b;
        b = temp;
      }
      return b;
    });
  }

  double HybridMath::getPi() {
    return M_PI;
  }

  double HybridMath::getPrecision() {
    return _precision;
  }

  void HybridMath::setPrecision(double precision) {
    _precision = precision;
  }

} // namespace margelo::nitro::math
```

### 4. Register in CMakeLists.txt

Add the implementation file to `android/CMakeLists.txt`:

```cmake
add_library(
  NitroMath
  SHARED
  ../nitrogen/generated/shared/c++/HybridMathSpec.cpp
  ../cpp/HybridMath.cpp   # ← add this
)
```

Current Nitro projects usually include generated C++ through `nitrogen/generated/android/<ModuleName>+autolinking.cmake`; prefer that generated CMake include when present instead of manually listing each generated source.

### 5. Verify using canonical type reference

For any type uncertainty, consult the canonical C++ test implementation:
[HybridTestObjectCpp.cpp](https://github.com/mrousavy/nitro/blob/main/packages/react-native-nitro-test/cpp/HybridTestObjectCpp.cpp)

## Code Examples

### Type reference table

| TypeScript | C++ Type | Notes |
|-----------|----------|-------|
| `number` | `double` | Always `double`, never `float` |
| `string` | `const std::string&` (param) / `std::string` (return) | |
| `boolean` | `bool` | |
| `bigint` (signed) | `int64_t` | |
| `bigint` (unsigned) | `uint64_t` | |
| `T[]` | `std::vector<T>` | e.g. `std::vector<double>`, `std::vector<std::string>` |
| `Promise<T>` | `std::shared_ptr<Promise<T>>` | Use `Promise<T>::async(lambda)` |
| `Promise<void>` | `std::shared_ptr<Promise<void>>` | |
| `T \| undefined` | `std::optional<T>` | |
| `T \| U` | `std::variant<T, U>` | e.g. `std::variant<std::string, double>` |
| `(x: T) => void` | `std::function<void(T)>` | |
| `() => T` | `std::function<T()>` | |
| `ArrayBuffer` | `std::shared_ptr<ArrayBuffer>` | |
| `AnyMap` / `Record` | `std::shared_ptr<AnyMap>` | Nitro's generic map type |
| `Record<string, T>` | `std::unordered_map<std::string, T>` | For simple typed maps |
| `HybridObject` | `std::shared_ptr<HybridSpec>` | e.g. `std::shared_ptr<HybridMathSpec>` |
| `null` / `NullType` | `NullType` | Use `nitro::null` constant |
| `Date` | `std::chrono::system_clock::time_point` | |

### Throwing errors

```cpp
double HybridMath::divide(double a, double b) {
  if (b == 0) {
    throw std::runtime_error("Division by zero!");
  }
  return a / b;
}
```

### Callback parameter

```cpp
void HybridMath::compute(double input, std::function<void(double)> onResult) {
  double result = input * 2;
  onResult(result);
}
```

Keep quick, deterministic, local work synchronous. Do not introduce `Promise`, executors, or callback plumbing for simple value construction, cached metadata, or pure transforms. Use an owned executor/thread or Nitro Promise only for heavy work, I/O, platform async APIs, or work that must not block the caller.

Avoid platform main/UI threads unless the platform API requires them. Keep main-thread sections limited to UI/view work and move parsing, conversion, I/O, session negotiation, and CPU work to an owned executor/thread or async API.

Treat `std::mutex` as last-resort synchronization, not default callback or listener plumbing. Before adding one to a HybridObject, identify the concrete shared mutable values, the threads that can access them concurrently, and why one owner thread/queue, message passing, or immutable snapshots is not enough.

Never invoke JS/Nitro callbacks while holding a mutex. Copy or snapshot listener collections if needed, unlock, then call them. A listener removed during an in-flight emission may receive that current event.

Treat repeated executor, queue, platform, callback, and JS/Nitro runtime hops as an architecture smell. A HybridObject/session should own the executor/thread it works on, or cross into that owner once at the Promise, lifecycle, or native callback boundary. If an operation bounces through multiple nested contexts, redesign the object boundary or returned handle instead of adding more hops.

Do not fix lifecycle, readiness, or race bugs with `sleep_for`, `usleep`, timers, extra executor hops, or calling the same native method twice. Use an explicit Promise, callback, listener event, returned configured HybridObject, state transition, or owner queue instead. Retry only for external hardware, OS service, remote service, or network uncertainty, with bounded/cancellable/idempotent behavior.

Avoid manually creating or passing around `std::shared_ptr<Promise<T>>` by default. Prefer `Promise<T>::async(...)`, `Promise<T>::resolved(...)`, or `Promise<T>::rejected(...)` so the helper owns exactly-once completion. Use `Promise<T>::create()` only when bridging a native completion/callback API; keep it near the bridge, do not pass it through arbitrary helpers or session objects, and make every branch resolve or reject exactly once.

### C++ style and organization

- Treat `cpp/HybridDataScanner.cpp` as the implementation file for `HybridDataScanner`, not as a dumping ground for unrelated geometry conversions, OpenCV helpers, platform adapters, or utility functions.
- Keep one primary class, cohesive algorithm, or small variant family per file by default.
- Move reusable conversions, adapters, thread helpers, and platform shims into named files such as `GeometryConversions.cpp`, `FrameProcessorAdapter.cpp`, or `DataScannerSession.cpp`.
- Use anonymous namespaces only for small helpers that serve the file's primary type. Put larger reusable helpers in a `detail` namespace or an internal folder.
- Use line count as a review signal: under roughly 300 lines is usually acceptable, while files above that need a concrete reason tied to one cohesive responsibility. A large file caused by helpers or glue belongs in multiple files.
- Put one-element conversions on the source type or a one-element converter function. The converter may return a vector/set when one source value expands to several native values.
- Compose collections where they are used with standard loops, `std::transform`, set insertion, or accumulation. Keep an aggregate helper only when it owns real collection semantics such as deduplication, validation across elements, nonempty checks, batching, caching, or error aggregation.

## Common Pitfalls

- **Wrong namespace** — The namespace must match `cxxNamespace` in `nitro.json` (e.g. `margelo::nitro::math`)
- **Forgetting `override`** — All virtual method implementations need `override`
- **Using `float` instead of `double`** — Nitro uses `double` for all `number` types
- **Inventing async return types** — Generated async methods return `std::shared_ptr<Promise<T>>`. Copy the generated signature exactly and prefer `Promise<T>::async(...)`, `Promise<T>::resolved(...)`, or `Promise<T>::rejected(...)`; use `Promise<T>::create()` only for real native completion/callback bridges.
- **Missing `TAG` member** — Required for `HybridObject(TAG)` constructor call
- **Letting one HybridObject file absorb every helper** — Split converters, adapters, utility functions, and platform glue into named files. The filename should still describe the file after the implementation is done.
- **Putting trivial transforms behind vector helpers** — Prefer a one-element converter plus standard collection composition at the call site. A collection helper is justified only when the collection itself adds behavior such as deduplication or validation.

## Related Skills

- [cpp](../../cpp/SKILL.md) — General C++ API, ownership, and file-organization guidance
- [native-nitrogen-codegen.md](native-nitrogen-codegen.md) — Must generate specs before implementing
- [spec-nitro-json.md](spec-nitro-json.md) — Configure `"c++"` in autolinking
- [native-implement-kotlin.md](native-implement-kotlin.md) — Android Kotlin alternative
- [native-implement-swift.md](native-implement-swift.md) — iOS Swift alternative
