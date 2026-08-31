---
title: Running Nitrogen and Verifying Generated Code
impact: HIGH
tags: nitrogen, codegen, generated, bunx, bun, specs, verification, typescript-parser
---

# Skill: Running Nitrogen and Verifying Generated Code

Covers Steps 6–7: running the Nitrogen codegen tool and verifying the generated native files.

Generated files under `nitrogen/generated/` are build outputs. Do not manually edit them; update `.nitro.ts` specs or native implementation files and re-run nitrogen. Generated files may be committed to git, and many Nitro libraries do this, but the project can also choose not to. They must be present in the npm package.

## Quick Commands

```bash
# From the package folder
cd packages/react-native-math
bunx nitrogen

# OR add a root script and run from root:
# In root package.json: "specs": "bun --cwd packages/react-native-math run specs"
bun specs
```

## When to Use

- After writing the `*.nitro.ts` spec AND updating `nitro.json`
- After any change to the spec file (re-run to regenerate)
- When generated files are missing or out of date

## Prerequisites

- `*.nitro.ts` spec file written and saved
- `nitro.json` configured with correct autolinking
- `react-native-nitro-modules` installed in the package

## Step-by-Step

### 1. Navigate to the package folder

```bash
cd packages/react-native-math
```

Nitrogen must be run from the **package root** (where `nitro.json` lives), not from the monorepo root.

### 2. Run Nitrogen

```bash
bunx nitrogen
```

Or if the package has a `specs` script in its `package.json`:

```bash
bun run specs
# or from monorepo root with:
bun specs
```

### 3. Add a `specs` script to the package `package.json`

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "specs": "tsc --noEmit false && nitrogen"
  }
}
```

### 4. Add a root shortcut

In the monorepo root `package.json`:

```json
{
  "scripts": {
    "specs": "bun --cwd packages/react-native-math run specs"
  }
}
```

### 5. Verify the generated folder structure

After running, check `nitrogen/generated/`:

```
nitrogen/generated/
├── ios/
│   ├── NitroMath+autolinking.rb
│   ├── NitroMathAutolinking.swift
│   ├── c++/
│   └── swift/
│       └── HybridMathSpec.swift       ← Swift protocol/base spec
├── android/
│   ├── NitroMath+autolinking.gradle
│   ├── NitroMath+autolinking.cmake
│   ├── c++/
│   └── kotlin/com/margelo/nitro/math/
│       └── HybridMathSpec.kt          ← Kotlin abstract class
└── shared/
    └── c++/
        ├── HybridMathSpec.hpp         ← C++ abstract class
        └── HybridMathSpec.cpp         ← Generated C++ glue
```

Older generated layouts may be flatter, but current Nitro output commonly uses `ios/swift`, `ios/c++`, `android/kotlin`, `android/c++`, and `shared/c++` subdirectories.

### 6. Ensure generated sources are wired into the native build

If the Nitro template already added these hooks, verify them instead of duplicating them.

In the iOS podspec, load the generated autolinking Ruby file and call `add_nitrogen_files(s)`:

```ruby
load 'nitrogen/generated/ios/NitroMath+autolinking.rb'
add_nitrogen_files(s)
```

In Android `build.gradle`, load the generated Gradle file:

```groovy
apply from: '../nitrogen/generated/android/NitroMath+autolinking.gradle'
```

In Android `CMakeLists.txt`, include the generated CMake file after `add_library(...)`:

```cmake
include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/NitroMath+autolinking.cmake)
```

In the JNI entry point, call the generated native registration function:

```cpp
#include "NitroMathOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return facebook::jni::initialize(vm, []() {
    margelo::nitro::math::registerAllNatives();
  });
}
```

### 7. Troubleshoot missing files

If no files are generated:
- Verify the spec file ends in `.nitro.ts` (not `.ts`)
- Verify the interface name in the spec matches the autolinking key in `nitro.json`
- Check that you ran `bunx nitrogen` from inside the package folder (where `nitro.json` is)
- Run with verbose output: `bunx nitrogen --verbose`

## Older Generated Layout Example

Some older generated trees look like:

```
nitrogen/generated/
├── ios/
│   └── HybridMathSpec.swift       ← Swift protocol/base spec
├── android/
│   └── com/margelo/nitro/math/
│       └── HybridMathSpec.kt      ← Kotlin abstract class
└── shared/
    ├── HybridMathSpec.hpp         ← C++ abstract class
    └── NitroMathSpecs.hpp         ← Registry header
```

## Code Examples

### Example generated Swift spec shape

```swift
// nitrogen/generated/ios/swift/HybridMathSpec.swift
public protocol HybridMathSpec_protocol: HybridObject {
  func add(a: Double, b: Double) throws -> Double
}

open class HybridMathSpec_base {
  // Generated C++ bridge ownership lives here.
}

public typealias HybridMathSpec = HybridMathSpec_protocol & HybridMathSpec_base
```

Older generated Swift specs may use a single protocol instead of the protocol/base typealias, but implementation code should still inherit or conform to `HybridMathSpec`.

### Generated HybridObject requirements

Generated specs also include the base HybridObject requirements:

```swift
var hybridContext: margelo.nitro.HybridContext { get set }
var memorySize: Int { get }
```

### Example generated Kotlin spec

```kotlin
// nitrogen/generated/android/kotlin/com/margelo/nitro/math/HybridMathSpec.kt
abstract class HybridMathSpec: HybridObject() {
  abstract fun add(a: Double, b: Double): Double
}
```

### Root `package.json` scripts

```json
{
  "scripts": {
    "specs": "bun --cwd packages/react-native-math run specs",
    "example": "bun --cwd apps/example"
  }
}
```

## Common Pitfalls

- **Running from wrong directory** — Always run `bunx nitrogen` from the package root (where `nitro.json` is), not the monorepo root
- **Re-run after every spec change** — Generated files go stale the moment you modify the `.nitro.ts` file
- **Stale generated files** — If you rename an interface, delete old generated files first to avoid conflicts

## Related Skills

- [spec-hybrid-object.md](spec-hybrid-object.md) — Must write the spec before running nitrogen
- [spec-nitro-json.md](spec-nitro-json.md) — Must configure `nitro.json` before running nitrogen
- [native-implement-swift.md](native-implement-swift.md) — Next: implement the generated Swift spec
- [native-implement-kotlin.md](native-implement-kotlin.md) — Next: implement the generated Kotlin spec
- [native-implement-cpp.md](native-implement-cpp.md) — Next: implement the generated C++ spec
