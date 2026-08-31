---
title: Metro Config, Library Install, and Running the Example
impact: HIGH
tags: metro, watchFolders, bun, install, App.tsx, example, android, ios, scripts, pod-install
---

# Skill: Metro Config, Library Install, and Running the Example

Covers Steps 16–20: configuring Metro watchFolders, installing the library in the example app, implementing App.tsx, adding root scripts, and running on Android and iOS.

## Quick Commands

```bash
# Configure Metro if it cannot resolve the package from the chosen example app layout

# Install library in the example app.
# apps/example layout:
cd apps/example
bun add ../../packages/react-native-math
bun add react-native-nitro-modules@<same-version-as-package>

# example/ layout:
# cd example
# bun add ../packages/react-native-math
# bun add react-native-nitro-modules@<same-version-as-package>

# iOS: install pods
cd ios && pod install && cd ..

# Run
bun example android
bun example ios
```

## When to Use

- After Android Gradle paths are verified or configured
- When Metro can't resolve the local library package
- When setting up the example app to test the module

## Prerequisites

- Example app created in `apps/example/`, `example/`, or another chosen layout
- Android Gradle paths verified, or corrected only if the chosen layout requires it
- Library package is in `packages/<name>`

## Step-by-Step

### 1. Configure Metro watchFolders

Open `apps/example/metro.config.js` and add the monorepo root to `watchFolders`:

```javascript
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

const config = {
  watchFolders: [root],
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
```

Without `watchFolders`, Metro only watches the example app directory and can't find your library in `packages/`.

For a shallower `example/` layout, the monorepo root is one level up instead:

```javascript
const root = path.resolve(__dirname, '..');
```

### 2. Install the library

```bash
cd apps/example
bun add ../../packages/react-native-math
```

This creates a symlink from `apps/example/node_modules/react-native-math` to `packages/react-native-math`.

For a shallower `example/` layout, use:

```bash
cd example
bun add ../packages/react-native-math
```

### 3. Install `react-native-nitro-modules` at a pinned version

The version must match what `packages/react-native-math` uses:

```bash
# Check what version the package uses
cat ../../packages/react-native-math/package.json | grep nitro-modules
# from example/: cat ../packages/react-native-math/package.json | grep nitro-modules

# Install the same version in example
bun add react-native-nitro-modules@<same-version-as-package>
```

Having two different versions of `react-native-nitro-modules` can cause runtime/build crashes.

### 4. Install iOS pods

```bash
cd apps/example/ios
pod install
cd ../../..
```

Run this after any new native dependency is added.

### 5. Implement App.tsx

Replace the default `apps/example/App.tsx` with a test implementation:

```tsx
import React, { useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { math } from 'react-native-math';

function App(): React.JSX.Element {
  const [result, setResult] = useState<number | null>(null);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Math Module Test</Text>
      <Button
        title="Add 5 + 7"
        onPress={() => setResult(math.add(5, 7))}
      />
      {result !== null && (
        <Text style={styles.result}>Result: {result}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  result: { fontSize: 32, marginTop: 20 },
});

export default App;
```

### 6. Add root scripts

In the monorepo root `package.json`:

```json
{
  "scripts": {
    "specs": "bun --cwd packages/react-native-math run specs",
    "example": "bun --cwd apps/example"
  }
}
```

This enables:
- `bun example android` — runs the example on Android
- `bun example ios` — runs the example on iOS
- `bun example start` — starts the Metro bundler

### 7. Run on Android

```bash
bun example android
# or directly:
cd apps/example && bun android
```

Watch for errors in logcat if the build succeeds but the app crashes.

### 8. Run on iOS

```bash
bun example ios
# or directly:
cd apps/example && bun ios
```

## Code Examples

### `apps/example/metro.config.js` (complete)

```javascript
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [root],
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
```

### Root `package.json` scripts (complete)

```json
{
  "scripts": {
    "specs": "bun --cwd packages/react-native-math run specs",
    "example": "bun --cwd apps/example",
    "example:android": "bun --cwd apps/example android",
    "example:ios": "bun --cwd apps/example ios"
  }
}
```

### Async method usage in App.tsx

```tsx
const [fibResult, setFibResult] = useState<number | null>(null);

const calculateFib = async () => {
  const result = await math.calculateFibonacci(10);
  setFibResult(result);
};
```

## Common Pitfalls

- **Missing `watchFolders`** — Metro won't find the library package; add it to `metro.config.js`
- **`react-native-nitro-modules` version mismatch** — Install the exact same version in example as in the package
- **Forgetting `pod install`** — iOS won't pick up new native libraries without running `pod install`
- **Only testing JS bundling** — Nitro code needs a native build. Test on an iOS simulator/device or Android emulator/device, not only Metro, web, or a JS-only test runner.
- **Metro cache stale** — If you change the lib and Metro doesn't pick it up, run `bun example start --reset-cache`

## Related Skills

- [example-app-setup.md](example-app-setup.md) — Create the example app first
- [example-android-config.md](example-android-config.md) — Verify Android Gradle paths, and fix them only when the chosen layout requires it
- [spec-package-publish.md](spec-package-publish.md) — Final step: prepare for npm publishing
