---
title: Creating and Wiring the Example App
impact: HIGH
tags: example-app, react-native-cli, workspace, version-alignment, monorepo, init, skip-install
---

# Skill: Creating and Wiring the Example App

Covers Steps 11–13: creating the React Native example app with RN CLI, adding it to the monorepo workspace, and aligning dependency versions.

## Quick Commands

```bash
# Create example app (from monorepo root)
bunx @react-native-community/cli@latest init --skip-install MathExample

# Move to apps/example/ when multiple examples are needed or likely, or example/ for a shallower layout
mkdir -p apps
mv MathExample apps/example
# Alternative: mv MathExample example

# Add to workspace, then install
bun install
```

## When to Use

- **Only proceed with this file if the user confirmed they want an example app** (asked in the initial questions)
- After native implementation is complete and you need a testable example app
- When setting up the monorepo for the first time

## Prerequisites

- Library package in `packages/<name>` is scaffolded and implemented
- Root `package.json` has `workspaces` field

## Step-by-Step

### 1. Create the example app

Run from the **monorepo root**:

```bash
bunx @react-native-community/cli@latest init --skip-install MathExample
```

- Use `--skip-install` to avoid installing into the wrong directory
- Prefer `bunx`; fall back to `npx` only if the React Native CLI does not run correctly through Bun
- Name the app based on the library (e.g. `MathExample`, `CameraExample`)
- See [RN CLI docs](https://github.com/react-native-community/cli/blob/main/docs/commands.md#init) for additional options

### 2. Choose the example app location

The scaffold creates a folder named `MathExample`. Prefer the VisionCamera-style `apps/example` layout when multiple examples are needed or likely, including optional native dependencies, feature variants, or separate integration demos:

```bash
mkdir -p apps
mv MathExample apps/example
```

For intentionally small single-example libraries, a shallower `example/` app is also valid and can keep more React Native generated config working out of the box:

```bash
mv MathExample example
```

Choose one layout. The larger monorepo layout looks like:

```
.
├── packages/
│   └── react-native-math/
├── apps/
│   └── example/          ← example app lives here
│       ├── android/
│       ├── ios/
│       ├── App.tsx
│       └── package.json
└── package.json          ← root workspace
```

Keep the app close to the official React Native template. Prefer generated config, official APIs, and template-supported extension points. Avoid custom Metro, Gradle, Podfile, native project, or postinstall plumbing unless the chosen repo layout truly requires it; if it does, make the smallest targeted change and look for the root cause before adding another workaround.

### 3. Add the example app to root workspaces

In the root `package.json`:

```json
{
  "workspaces": [
    "packages/*",
    "apps/*"
  ]
}
```

If the app lives at `example/`, use:

```json
{
  "workspaces": [
    "packages/*",
    "example"
  ]
}
```

### 4. Align React Native versions

**This is critical** — two different versions of `react-native` in the same monorepo causes cryptic build failures.

Check the example app's RN version:
```bash
cat apps/example/package.json | grep '"react-native"'
# or, for the shallower layout:
cat example/package.json | grep '"react-native"'
```

Open `packages/react-native-math/package.json` and ensure:
```json
{
  "peerDependencies": {
    "react": "*",
    "react-native": "*",
    "react-native-nitro-modules": "*"
  },
  "devDependencies": {
    "react": "<same-as-example>",
    "react-native": "<same-as-example>"
  }
}
```

- If the package's `devDependencies` version is **lower** than the example, **upgrade it** to match
- Also align: `react`, `@babel/core`, `metro`, `@react-native/metro-config`
- There must be **zero duplicate versions** of any shared library

### 5. Install from root

```bash
bun install
```

## Code Examples

### Root `package.json` (after setup)

```json
{
  "name": "react-native-math-root",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "specs": "bun --cwd packages/react-native-math run specs",
    "example": "bun --cwd apps/example"
  }
}
```

For a shallower `example/` app, change the workspace to `"example"` and the script to `"example": "bun --cwd example"`.

### Package `package.json` aligned versions

```json
{
  "name": "react-native-math",
  "peerDependencies": {
    "react": "*",
    "react-native": "*",
    "react-native-nitro-modules": "*"
  },
  "devDependencies": {
    "react": "<same-as-example>",
    "react-native": "<same-as-example>",
    "react-native-nitro-modules": "<same-as-package>"
  }
}
```

### Version check command

```bash
# Check for duplicate react-native installs
find . -name "package.json" -not -path "*/node_modules/*" | xargs grep '"react-native"' | grep -v workspace
```

## Common Pitfalls

- **Forgetting `--skip-install`** — Without it, npm/yarn installs from the wrong directory; use `--skip-install` then `bun install` from root
- **Two RN versions** — Even a minor version mismatch causes cryptic `Invariant Violation` errors at runtime
- **Workspace path mismatch** — The app folder must match the workspace glob, either `apps/*` for `apps/example` or `example` for the shallower layout
- **Running `pod install` before workspace is set up** — Do `bun install` from root first, then `pod install`

## Related Skills

- [example-android-config.md](example-android-config.md) — Next: verify Android Gradle paths; fix them only if the chosen layout requires it
- [example-metro-install.md](example-metro-install.md) — Next: configure Metro and install the library
