---
title: Building Nitro Views (Hybrid View Components)
impact: HIGH
tags: nitro-views, hybrid-view, getHostComponent, hybridRef, fabric, view-component, lifecycle, onDropView, recycling, callback
---

# Skill: Building Nitro Views (Hybrid View Components)

Covers creating a native React Native view component with Nitro: the `HybridView` spec, native Swift/Kotlin implementation, Android view manager registration, the `getHostComponent` JS wrapper, imperative methods via `hybridRef`, callback props, and view recycling.

A Hybrid View is a HybridObject that can also be rendered. It is backed by a C++ ShadowNode and rendered through Fabric, but uses Nitro for prop parsing instead of Fabric codegen. One HybridObject instance is created per rendered view.

## Requirements

- React Native **0.78.0+** and the **New Architecture** (Fabric). Plain HybridObjects only need RN 0.75+; views need more.
- Verify current requirements in the Nitro docs before debugging build failures.

## When to Use

- Creating a native view component (`<Camera>`, `<ImageView>`, `<VideoPlayer>`) in a Nitro library
- Adding props, callbacks, or imperative methods to an existing Nitro View
- Wiring a generated view into JS with `getHostComponent`
- Fixing "view manager not found" errors on Android
- Callback props arriving as `true` instead of a function on the native side
- Implementing view recycling / resetting state on reuse

## Step-by-Step

### 1. Write the view spec (`src/specs/CameraView.nitro.ts`)

Declare a props interface, an optional methods interface, and a type that specializes `HybridView<Props, Methods>`:

```typescript
import type {
  HybridView,
  HybridViewProps,
  HybridViewMethods,
} from 'react-native-nitro-modules'
import type { Image } from './Image.nitro'

export interface CameraViewProps extends HybridViewProps {
  enableFlash: boolean
  onCaptured: (image: Image) => void
}
export interface CameraViewMethods extends HybridViewMethods {
  takePhoto(): Promise<Image>
}

export type CameraView = HybridView<CameraViewProps, CameraViewMethods>
```

Rules:
- Props go in `...Props extends HybridViewProps`; imperative methods go in `...Methods extends HybridViewMethods`. Both are implemented natively.
- Any Nitro-supported type works as a prop — literal unions, structs, `ArrayBuffer`, and even other HybridObjects (e.g. an `ImageView` accepting an `image: Image` HybridObject prop).
- Platforms default to `{ ios: 'swift'; android: 'kotlin' }`; pass a third type argument to `HybridView` only when overriding.
- A Hybrid View is a primary API object: give it its own `.nitro.ts` file, and put named prop types (unions, structs, option objects) in their own `.ts` files like any other codegen types.

### 2. Add the autolinking entry (`nitro.json`)

Hybrid Views are created by the renderer, so they must be autolinked like a root HybridObject:

```json
"autolinking": {
  "CameraView": {
    "ios": {
      "language": "swift",
      "implementationClassName": "HybridCameraView"
    },
    "android": {
      "language": "kotlin",
      "implementationClassName": "HybridCameraView"
    }
  }
}
```

### 3. Run nitrogen

```bash
bunx nitrogen
```

Beyond the usual `Hybrid*Spec` files, nitrogen generates for each view:
- A C++ ShadowNode/component (`views/Hybrid*Component.*`)
- An Android view manager (`views/Hybrid*ViewManager.kt`)
- A Fabric view config JSON at `nitrogen/generated/shared/json/CameraViewConfig.json` — required by `getHostComponent`

### 4. Implement the native view

Implement the generated spec plus the required `view` accessor.

**Swift** (`ios/HybridCameraView.swift`):

```swift
import NitroModules
import UIKit

final class HybridCameraView: HybridCameraViewSpec {
  // View
  var view = CameraPreviewView()

  // Props
  var enableFlash: Bool = false {
    didSet { applyFlashMode() }
  }
  var onCaptured: (Image) -> Void = { _ in }

  // Methods
  func takePhoto() throws -> Promise<Image> {
    // ...
  }
}
```

**Kotlin** (`android/src/main/java/.../HybridCameraView.kt`):

```kotlin
package com.margelo.nitro.camera

import android.view.View
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext

@Keep
@DoNotStrip
class HybridCameraView(
  val context: ThemedReactContext,
) : HybridCameraViewSpec() {
  // View
  override val view = CameraPreviewView(context)

  // Props
  override var enableFlash: Boolean = false
    set(value) {
      field = value
      applyFlashMode()
    }
  override var onCaptured: (Image) -> Unit = {}

  // Methods
  override fun takePhoto(): Promise<Image> {
    // ...
  }
}
```

Rules:
- The `view` member returns the platform view that gets mounted, and its value should not change during the HybridView's lifetime. Declare it with the concrete subclass type directly (`var view = UIImageView()` / `override val view = CameraPreviewView(context)`) — Swift's `HybridView` protocol types `view` via an `associatedtype ViewType: UIView`, and Kotlin allows covariant `val` overrides of the base `abstract val view: View`, so no `UIView`/`View` upcast or private-field indirection is needed.
- Hybrid Views must be implemented in **Swift on iOS and Kotlin on Android** — nitrogen rejects other autolinking languages for views, so there are no C++ (`"all"`) view implementations.
- Constructor requirements differ from plain autolinked HybridObjects: the Swift implementation must be **default-constructible** (the generated component view creates it with no arguments), while the Kotlin implementation must take a **`ThemedReactContext` constructor parameter** — the generated view manager instantiates it with `Impl(reactContext)`. This is the one exception to the "autolinked classes need a no-argument constructor" rule.
- React prop changes arrive as plain property sets — apply side effects in `didSet` (Swift) or a custom setter (Kotlin).
- Keep the annotations (`@Keep`, `@DoNotStrip`) on Kotlin view classes so ProGuard/R8 does not strip them.
- All the usual native rules apply: one top-level type per file, `final` by default in Swift, conversions in focused extension files, no thread hops hidden in property setters.

### 5. Android: register the view manager

Nitrogen generates the view manager, but you must register it in the library's React package:

```kotlin
class CameraPackage : BaseReactPackage() {
  // ...
  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    val viewManagers = ArrayList<ViewManager<*, *>>()
    viewManagers.add(HybridCameraViewManager())
    return viewManagers
  }
}
```

The generated manager lives in the generated `views` subpackage, e.g. `com.margelo.nitro.camera.views.HybridCameraViewManager`. The manager owns the view lifecycle: it constructs the Kotlin HybridView with the `ThemedReactContext`, tags the platform view with it, drives prop updates, and enables view recycling only when the implementation is a `RecyclableView`.

iOS needs no registration step — the generated component view registers itself with `RCTComponentViewFactory` in `+load`.

### 6. Wire the JS component with `getHostComponent`

Put the wrapper in its own file (e.g. `src/views/CameraView.ts`) and re-export from the barrel `src/index.ts`:

```typescript
import { getHostComponent, type HybridRef } from 'react-native-nitro-modules'
import CameraViewConfig from '../../nitrogen/generated/shared/json/CameraViewConfig.json'
import type {
  CameraViewProps,
  CameraViewMethods,
} from '../specs/CameraView.nitro'

export const Camera = getHostComponent<CameraViewProps, CameraViewMethods>(
  'CameraView',
  () => CameraViewConfig
)

export type CameraRef = HybridRef<CameraViewProps, CameraViewMethods>
```

Rules:
- The first argument must exactly match the `nitro.json` autolinking key.
- Expose the raw `getHostComponent` wrapper as the public component. Add React components or hooks on top only when they remove repeated setup code while staying layered over the same native objects and refs.
- Export a `HybridRef<Props, Methods>` alias so users can type refs.
- Name the exported component after the product/domain noun (`Camera`), not the spec type name.

### 7. Render and use it

```tsx
import { callback } from 'react-native-nitro-modules'

function App() {
  return (
    <Camera
      enableFlash={true}
      onCaptured={callback((image) => console.log(image.width))}
      hybridRef={callback((ref) => {
        const photo = ref.takePhoto()
      })}
    />
  )
}
```

## Callbacks Must Be Wrapped

React Native's renderer converts function props to booleans before native sees them, so function props cannot be passed to Nitro Views directly. Wrap **every** function prop — including `hybridRef` — with `callback(...)` from `react-native-nitro-modules`, which boxes the function in an object (`{ f }`) that bypasses the conversion.

A function prop that arrives as `true`, crashes prop parsing, or never fires almost always means a missing `callback(...)` wrapper.

## Imperative Methods via `hybridRef`

`hybridRef` hands you the underlying HybridObject itself — props, methods, `name`, everything. You can call spec methods on it, read or set props directly, and pass it around freely, including into other HybridObject methods (e.g. `HybridTestObject.getIsViewBlue(ref)` accepting the view's base spec type natively).

## Threading

Nitro bridges props directly to JS, so the implementation is responsible for thread-safety:

- Props set through React render on the **UI thread**.
- Props set through `hybridRef` (or from native via another HybridObject) can arrive on a **different thread**, such as the JS thread.

Pick one owner thread for the view's mutable state and cross into it at the boundary. Do not hide thread hops inside property setters — if state can only change on a specific thread, expose an async method or event instead.

## Lifecycle Hooks

Every Hybrid View inherits three optional lifecycle hooks from the `HybridView` base (all no-ops by default):

- `beforeUpdate()` — called right before a batch of React prop updates is applied
- `afterUpdate()` — called right after the batch; pair with `beforeUpdate()` to commit several prop changes as one native transaction instead of reacting to each setter individually
- `onDropView()` — called when the view is about to be dropped and unmounted; clean up view-related resources here (stop sessions, cancel loads, release observers)

The hooks are driven by the generated native glue: on iOS the generated `RCTViewComponentView` subclass calls `beforeUpdate()`/`afterUpdate()` around the prop assignments in `updateProps`, and on Android the generated `ViewManager.updateState` does the same. Only **dirty** (changed) props invoke their setters between the two hooks — unchanged props are skipped via Nitro's `CachedProp` dirty-checking. `hybridRef` is itself a cached prop and is invoked (with the HybridObject) after `afterUpdate()` whenever it changed.

**Platform caveat for `onDropView()`:** Android always calls it (from the view manager's `onDropViewInstance`). On iOS it is called from the component view's `invalidate`, which the generated code only compiles on **react-native 0.82+** — on older RN versions `onDropView()` never fires on iOS, so do not make critical cleanup iOS-reliant on it there.

```swift
final class HybridCameraView: HybridCameraViewSpec {
  var view: UIView = UIView()

  func beforeUpdate() { /* begin transaction */ }
  func afterUpdate() { /* commit once */ }
  func onDropView() { /* stop session, release resources */ }
}
```

Kotlin: `override fun beforeUpdate()` / `override fun afterUpdate()` / `override fun onDropView()`.

Note the split between the two teardown-adjacent hooks: `onDropView()` is for **unmount** cleanup on every view, while `prepareForRecycle()` (below) is only for views that opt into recycling and must reset displayed state before **reuse**.

## Recycling

Fabric can reuse a previously created view instead of allocating a new one. Opt in by conforming to `RecyclableView` and resetting all internal state in `prepareForRecycle()`:

**Swift:**

```swift
import NitroModules

final class HybridImageView: HybridImageViewSpec, RecyclableView {
  var view = UIImageView()

  func prepareForRecycle() {
    view.image = nil
  }
}
```

**Kotlin:**

```kotlin
import android.widget.ImageView
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext
import com.margelo.nitro.views.RecyclableView

@Keep
@DoNotStrip
class HybridImageView(
  val context: ThemedReactContext,
) : HybridImageViewSpec(),
  RecyclableView {
  override val view = ImageView(context)

  override fun prepareForRecycle() {
    view.setImageDrawable(null)
  }
}
```

Implement recycling for views that display async content (images, video frames, camera previews) — otherwise a recycled view shows stale content while new content loads. Reset every prop-derived and internal state field to its default.

## Common Pitfalls

- **Old architecture or RN < 0.78** — Nitro Views require RN 0.78+ and the New Architecture; there is no legacy fallback
- **Missing `callback(...)` wrapper** — function props (including `hybridRef`) silently become `true` on native
- **Android view manager not registered** — the generated `Hybrid*ViewManager` must be added in `createViewManagers`; iOS needs nothing
- **`getHostComponent` name mismatch** — the name string must match the `nitro.json` autolinking key exactly
- **View config not found** — import the generated `*ViewConfig.json` from `nitrogen/generated/shared/json/`; it must ship in the npm package
- **Creating Hybrid Views manually** — never `createHybridObject` a view spec; the renderer creates one instance per rendered view
- **State bleed on recycle** — conforming to `RecyclableView` but resetting only some fields shows stale content on reused views
- **Cleanup in `deinit`/GC instead of `onDropView()`** — the HybridObject may outlive the mounted view (e.g. a retained `hybridRef`); release view-related resources in `onDropView()`, which fires deterministically at unmount on Android, and on iOS from RN 0.82+
- **Android build error `compiled without the 'RN_SERIALIZABLE_STATE' flag`** — Nitro Views require the `RN_SERIALIZABLE_STATE` compile definition; if the library uses a hand-written `CMakeLists.txt`, make sure it is set
- **Thread assumptions in setters** — props can be set from the UI thread *or* other threads via `hybridRef`; guard shared state accordingly

## Related Skills

- [spec-hybrid-object.md](spec-hybrid-object.md) — Every Hybrid View is a HybridObject; all spec/type rules apply
- [spec-nitro-json.md](spec-nitro-json.md) — Autolinking configuration details
- [native-nitrogen-codegen.md](native-nitrogen-codegen.md) — Running nitrogen and verifying generated files
- [native-implement-swift.md](native-implement-swift.md) — Swift implementation patterns
- [native-implement-kotlin.md](native-implement-kotlin.md) — Kotlin implementation patterns
- [vision-camera-golden-standard.md](vision-camera-golden-standard.md) — Where views sit in a full library layout
