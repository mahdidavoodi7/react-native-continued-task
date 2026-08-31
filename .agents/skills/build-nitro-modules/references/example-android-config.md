---
title: Android Gradle Configuration for Nested Example Apps
impact: HIGH
tags: android, gradle, settings.gradle, build.gradle, monorepo, paths, hermesCommand, reactNativeDir
---

# Skill: Android Gradle Configuration for Nested Example Apps

Covers Steps 14–15: fixing `settings.gradle` and `app/build.gradle` when the example app layout means React Native's generated Android paths no longer point to the correct `node_modules`.

## Quick Config

Only apply this when the example app is nested under `apps/example` and root `node_modules` lives at the workspace root. A shallower `example/` app or standalone app layout may work with the generated React Native config; if the generated paths resolve, leave them alone.

Treat these edits as narrow layout adaptations, not a place to accumulate workaround plumbing. Prefer the official React Native Gradle plugin APIs and generated template shape; if Android needs more than path-depth corrections, investigate the package layout, workspace install, autolinking, or upstream issue first.

Two files need path corrections for the `apps/example` layout:

**`apps/example/android/settings.gradle`** — fix React Native Gradle plugin paths:
```groovy
pluginManagement { includeBuild("../../../node_modules/@react-native/gradle-plugin") }
plugins { id("com.facebook.react.settings") }
extensions.configure(com.facebook.react.ReactSettingsExtension) { ex -> ex.autolinkLibrariesFromCommand() }
rootProject.name = 'MathExample'
include ':app'
includeBuild("../../../node_modules/@react-native/gradle-plugin")
```

Replace the generated `settings.gradle` block with this. Do not keep older `example/android` paths, `includeBuild("../../node_modules/...")`, `native_modules.gradle`, or `applyNativeModulesSettingsGradle(...)` lines.

**`apps/example/android/app/build.gradle`** — fix react{} block paths:
```groovy
react {
    reactNativeDir = file("../../../../node_modules/react-native")
    codegenDir = file("../../../../node_modules/@react-native/codegen")
    cliFile = file("../../../../node_modules/react-native/cli.js")
    hermesCommand = "$rootDir/../../../node_modules/hermes-compiler/hermesc/%OS-BIN%/hermesc"
    autolinkLibrariesWithApp()
}
```

## When to Use

- When an example app is nested deeply enough that React Native's generated Android paths do not resolve
- Whenever Android builds fail with `FileNotFoundException` for gradle-plugin or react-native paths
- When using the VisionCamera-style `apps/<name>` layout with root-level workspace dependencies
- Do not use this just because the repo is a monorepo. Verify the generated paths first; shallower `example/` or standalone example apps can work out of the box.

## Prerequisites

- Example app created and moved to `apps/example/` folder, or another nested folder whose generated paths do not resolve
- Root `node_modules/` installed at the monorepo root

## Path Depth Reference

For a monorepo structured as:
```
<root>/                        ← node_modules/ lives here
  apps/
    example/
      android/
        settings.gradle        ← 3 levels up to root: ../../../
        app/
          build.gradle         ← 4 levels up to root: ../../../../
```

`$rootDir` in Gradle refers to `<root>/apps/example/android/`.
So `$rootDir/../../..` reaches the monorepo root.

If the app lives one level shallower at `<root>/example/android/`, do not blindly apply the `apps/example` paths. First check whether the generated config already resolves `node_modules`. If it does, keep it. If root workspace dependencies require a manual path, count from `example/android/` to the workspace root instead.

## Step-by-Step

### 1. Fix `apps/example/android/settings.gradle`

Open `apps/example/android/settings.gradle` and make the React Native Gradle plugin paths point to the monorepo root:

```groovy
pluginManagement { includeBuild("../../../node_modules/@react-native/gradle-plugin") }
plugins { id("com.facebook.react.settings") }
extensions.configure(com.facebook.react.ReactSettingsExtension) { ex -> ex.autolinkLibrariesFromCommand() }
rootProject.name = 'MathExample'
include ':app'
includeBuild('../../../node_modules/@react-native/gradle-plugin')
```

This is a replacement for the generated React Native settings file, not an append. If the file still contains `includeBuild("../../node_modules/@react-native/gradle-plugin")` or legacy `native_modules.gradle` lines, remove them.

### 2. Fix `apps/example/android/app/build.gradle`

Open `apps/example/android/app/build.gradle` and find the `react { }` block. Replace with:

```groovy
react {
    /* Folders */
    // Root of your project (where root package.json lives)
    // root = file("../../../")

    // react-native NPM package location
    reactNativeDir = file("../../../../node_modules/react-native")

    // @react-native/codegen package location
    codegenDir = file("../../../../node_modules/@react-native/codegen")

    // react-native CLI entrypoint
    cliFile = file("../../../../node_modules/react-native/cli.js")

    /* Hermes */
    // hermesc is 3 levels up from $rootDir (which is apps/example/android/)
    hermesCommand = "$rootDir/../../../node_modules/hermes-compiler/hermesc/%OS-BIN%/hermesc"

    /* Autolinking — keep this */
    autolinkLibrariesWithApp()
}
```

### 3. Verify the paths exist

```bash
# Verify react-native is at root
ls ../../../node_modules/react-native/package.json

# Verify codegen
ls ../../../node_modules/@react-native/codegen/package.json

# Verify hermes-compiler
ls ../../../node_modules/hermes-compiler/
```

Run from `apps/example/android/` to match the relative path perspective.

### 4. Build to verify

```bash
cd apps/example
bun android
# or from root:
bun example android
```

## Code Examples

### Complete `settings.gradle` (corrected)

```groovy
pluginManagement {
    includeBuild("../../../node_modules/@react-native/gradle-plugin")
}
plugins { id("com.facebook.react.settings") }
extensions.configure(com.facebook.react.ReactSettingsExtension) { ex -> ex.autolinkLibrariesFromCommand() }
rootProject.name = 'MathExample'
include ':app'
includeBuild('../../../node_modules/@react-native/gradle-plugin')
```

### Complete corrected `react {}` block in `build.gradle`

```groovy
react {
    reactNativeDir = file("../../../../node_modules/react-native")
    codegenDir = file("../../../../node_modules/@react-native/codegen")
    cliFile = file("../../../../node_modules/react-native/cli.js")
    hermesCommand = "$rootDir/../../../node_modules/hermes-compiler/hermesc/%OS-BIN%/hermesc"
    autolinkLibrariesWithApp()
}
```

## Common Pitfalls

- **Wrong path depth** — Count the directory levels from the file to the monorepo root carefully
- **`$rootDir` is not the monorepo root** — In Gradle, `$rootDir` is `apps/example/android/`, not the monorepo root
- **Forgetting `autolinkLibrariesWithApp()`** — This must stay in the `react {}` block for autolinking to work
- **Editing both files** — Both `settings.gradle` AND `app/build.gradle` need to be updated; missing one causes different failures
- **Hermes path uses `$rootDir` as base** — `$rootDir/../../../node_modules/hermes-compiler/...` goes from `apps/example/android/` up 3 levels to reach monorepo root

## Related Skills

- [example-app-setup.md](example-app-setup.md) — Create the example app first
- [example-metro-install.md](example-metro-install.md) — Next: configure Metro and run the example
