---
title: Preparing the Package for npm Publishing
impact: MEDIUM
tags: package.json, npm, publish, files, author, metadata, npm-pack, podspec
---

# Skill: Preparing the Package for npm Publishing

Covers publish metadata and npm package contents.

## Quick Config

```json
{
  "name": "react-native-math",
  "version": "0.1.0",
  "description": "Fast, type-safe math utilities for React Native powered by Nitro Modules",
  "author": "Your Name <your@email.com>",
  "contributors": [
    "Contributor Name <contributor@email.com>"
  ],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/react-native-math.git"
  },
  "homepage": "https://math.margelo.com",
  "bugs": {
    "url": "https://github.com/yourusername/react-native-math/issues"
  },
  "keywords": [
    "react-native",
    "nitro-modules",
    "ios",
    "android",
    "math"
  ],
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc",
    "specs": "tsc --noEmit false && nitrogen"
  },
  "files": [
    "src",
    "react-native.config.js",
    "lib",
    "nitrogen",
    "android/build.gradle",
    "android/gradle.properties",
    "android/fix-prefab.gradle",
    "android/CMakeLists.txt",
    "android/src",
    "ios/**/*.h",
    "ios/**/*.m",
    "ios/**/*.mm",
    "ios/**/*.cpp",
    "ios/**/*.swift",
    "cpp/**/*.h",
    "cpp/**/*.hpp",
    "cpp/**/*.cpp",
    "nitro.json",
    "*.podspec",
    "README.md"
  ]
}
```

## When to Use

- Before publishing to npm for the first time
- When consumers report missing files after installing the package
- When `nitro.json` autolinking fails for consumers of the published package

## Prerequisites

- Module builds and tests pass
- Example app runs on both Android and iOS
- `lib/` directory exists (run the build step first)

## Step-by-Step

### 1. Update SEO and ownership metadata

Set a concise, catchy description and complete metadata in `packages/react-native-math/package.json`. Keep this aligned with GitHub's About description, repository topics, README intro, npm tags, and docs site.

In `packages/react-native-math/package.json`:

```json
{
  "description": "Fast, type-safe math utilities for React Native powered by Nitro Modules",
  "keywords": [
    "react-native",
    "nitro-modules",
    "ios",
    "android",
    "math"
  ],
  "author": "Your Full Name <your@email.com>",
  "contributors": [
    "Contributor Name <contributor@email.com>"
  ],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/react-native-math.git"
  },
  "homepage": "https://math.margelo.com",
  "bugs": {
    "url": "https://github.com/yourusername/react-native-math/issues"
  }
}
```

For Margelo repos, prefer a short docs domain such as `<simple-name>.margelo.com` when a docs site exists. Otherwise use the GitHub README URL as `homepage`.

### 2. Set the `files` field

This controls what gets uploaded to npm. **Missing files = broken package for consumers.**

```json
{
  "files": [
    "src",
    "react-native.config.js",
    "lib",
    "nitrogen",
    "android/build.gradle",
    "android/gradle.properties",
    "android/fix-prefab.gradle",
    "android/CMakeLists.txt",
    "android/src",
    "ios/**/*.h",
    "ios/**/*.m",
    "ios/**/*.mm",
    "ios/**/*.cpp",
    "ios/**/*.swift",
    "cpp/**/*.h",
    "cpp/**/*.hpp",
    "cpp/**/*.cpp",
    "nitro.json",
    "*.podspec",
    "README.md"
  ]
}
```

Critical files that must be included:
- `nitrogen/` — Generated native glue and autolinking files; consumers need these for builds. These files may or may not be committed to git, but they must be published to npm.
- `nitro.json` — Required for autolinking to work
- `*.podspec` — Required for iOS CocoaPods integration. Prefer a root podspec named after `ios.iosModuleName`, for example `NitroMath.podspec` with `s.name = "NitroMath"`.
- `android/build.gradle`, `android/gradle.properties`, `android/CMakeLists.txt`, and `android/src` — Android build config and source files
- `ios/**/*.{h,m,mm,cpp,swift}` — iOS source files
- `cpp/**/*.{h,hpp,cpp}` — C++ implementation files (if using C++)
- `lib/` — Compiled TypeScript output (JS + type definitions)
- `src/` — TypeScript source for consumers who use `react-native` field in package.json
- `react-native.config.js` — Required if the package customizes React Native autolinking

### 3. Verify `main`, `module`, and `types` fields

```json
{
  "main": "lib/index",
  "module": "lib/index",
  "types": "lib/index.d.ts",
  "react-native": "src/index",
  "source": "src/index"
}
```

### 4. Build the package

```bash
cd packages/react-native-math
bun run build
# or:
bun run prepare
```

Ensure `lib/` is populated before packing.

Run `bun run specs` before publishing whenever `.nitro.ts` files changed so `nitrogen/` is current.

### 5. Dry run to verify file list

```bash
npm pack --dry-run
```

Check the output — every file listed in step 2 must appear. If `nitro.json`, `nitrogen/`, or `*.podspec` are missing, consumers' builds will fail.

### 6. Publish

```bash
npm publish
```

For one-command release automation, use [release-it-publishing.md](release-it-publishing.md).

## Code Examples

### Complete `package.json` metadata section

```json
{
  "name": "react-native-math",
  "version": "0.1.0",
  "description": "Fast, type-safe math utilities for React Native powered by Nitro Modules",
  "main": "lib/index",
  "module": "lib/index",
  "types": "lib/index.d.ts",
  "react-native": "src/index",
  "source": "src/index",
  "author": "Your Name <your@email.com>",
  "contributors": [
    "Contributor Name <contributor@email.com>"
  ],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/react-native-math.git"
  },
  "homepage": "https://math.margelo.com",
  "bugs": {
    "url": "https://github.com/yourusername/react-native-math/issues"
  },
  "keywords": [
    "react-native",
    "nitro-modules",
    "ios",
    "android",
    "math"
  ],
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc",
    "specs": "tsc --noEmit false && nitrogen"
  },
  "files": [
    "src",
    "react-native.config.js",
    "lib",
    "nitrogen",
    "android/build.gradle",
    "android/gradle.properties",
    "android/fix-prefab.gradle",
    "android/CMakeLists.txt",
    "android/src",
    "ios/**/*.h",
    "ios/**/*.m",
    "ios/**/*.mm",
    "ios/**/*.cpp",
    "ios/**/*.swift",
    "cpp/**/*.h",
    "cpp/**/*.hpp",
    "cpp/**/*.cpp",
    "nitro.json",
    "*.podspec",
    "README.md"
  ],
  "peerDependencies": {
    "react": "*",
    "react-native": "*",
    "react-native-nitro-modules": "*"
  }
}
```

### `.npmignore` (optional, to exclude dev files)

```
apps/
__tests__/
.github/
*.test.ts
tsconfig.json
babel.config.js
```

## Common Pitfalls

- **Missing `nitrogen` in `files`** — Consumers' native builds will fail because the generated C++ glue and autolinking files are absent
- **Missing `nitro.json` in `files`** — Autolinking won't work for consumers; they'll get "native module not found" errors
- **Publishing before building** — `lib/` must be populated before publishing; build first
- **Missing `*.podspec` in `files`** — iOS consumers won't be able to run `pod install`. The VisionCamera-style pattern is a root podspec, not one hidden under `ios/`.
- **Incorrect `types` path** — Points to a file that doesn't exist after build. VisionCamera-style packages use `lib/index.d.ts` when `build` emits a flat `lib/index`.

## Related Skills

- [setup-monorepo-init.md](setup-monorepo-init.md) — Review the Nitrogen scaffold
- [spec-nitro-json.md](spec-nitro-json.md) — Ensure `nitro.json` is complete before publishing
- [release-it-publishing.md](release-it-publishing.md) — Configure `bun release` with `release-it`
