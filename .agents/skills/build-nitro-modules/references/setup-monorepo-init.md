---
title: Nitrogen Scaffold
impact: CRITICAL
tags: nitrogen, init, workspace, bun, scaffold, package-json
---

# Skill: Nitrogen Scaffold

Covers collecting scaffold inputs and running `nitrogen init`.

## Quick Commands

```bash
# After collecting answers to all upfront questions, scaffold:
bunx nitrogen@latest init react-native-math
# This places the library in packages/react-native-math/

# After scaffold, install from root:
bun install
```

## When to Use

- **Only for new libraries** — if the user is adding a HybridObject to an existing library, skip this file entirely and go to [spec-hybrid-object.md](spec-hybrid-object.md)
- Starting a new Nitro module library from scratch
- Running the initial Nitrogen scaffold before writing specs

## Prerequisites

- Node.js and Bun installed
- Answers collected from the user (see Ask First section in SKILL.md)

## Step-by-Step

### 1. Collect answers before doing anything

Ask the user all of the following before running any command:

| Question | Default |
|----------|---------|
| What is the library name? (e.g. `react-native-math`) | — required |
| Use monorepo with `packages/<name>` folder? | **yes** |
| Create an example app to test the module? | **yes, `apps/example` unless the repo is intentionally small** |
| iOS language: `swift` or `cpp`? | **swift** |
| Android language: `kotlin` or `cpp`? | **kotlin** |
| What does this module do? (brief description) | — required |

Only proceed once all questions are answered.

### 2. Choose repo structure

Load [repo-structure-and-workflow.md](repo-structure-and-workflow.md). Use it to choose `packages/`, `apps/` versus `example/`, `config/`, CI, and workflow defaults before scaffolding.

If a root `package.json` does not exist yet, create one:

```json
{
  "name": "react-native-math-root",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*"
  ]
}
```

For the shallower layout, use `"example"` instead of `"apps/*"` in `workspaces`.

### 3. Confirm the library name

The library name should:
- Follow npm naming: `react-native-<domain>` (e.g. `react-native-math`, `react-native-camera`)
- Be lowercase, hyphen-separated
- Reflect the module's purpose

### 4. Scaffold with Nitrogen

Run from the monorepo root:

```bash
bunx nitrogen@latest init react-native-math
```

This creates `packages/react-native-math/` when using the monorepo layout. If the user explicitly chose a non-monorepo layout, run the same command from the target library parent and adjust later paths accordingly.

### 5. Verify the generated folder structure

```
packages/react-native-math/
├── NitroMath.podspec
├── android/
│   ├── src/main/java/com/margelo/nitro/<namespace>/
│   └── CMakeLists.txt
├── ios/
│   └── HybridMath.swift        ← later implementation
├── src/
│   └── specs/
│       └── Example.nitro.ts    ← delete this
├── nitrogen/
│   └── generated/              ← populated after running nitrogen
├── nitro.json
└── package.json
```

### 6. Add to root workspace

In the monorepo root `package.json`:

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

If the example app lives at `example/`, use `"workspaces": ["packages/*", "example"]` and `"example": "bun --cwd example"` instead.

### 7. Install from root

```bash
bun install
```

### 8. Add CI and workflow policy

Use [repo-structure-and-workflow.md](repo-structure-and-workflow.md) for CI, no-hook validation, branch, draft PR, squash merge, and atomic PR rules.

## Code Examples

### Root `package.json`

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
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

### Package `package.json` (generated, key fields)

```json
{
  "name": "react-native-math",
  "version": "0.1.0",
  "description": "A React Native Math module built with Nitro",
  "main": "lib/index",
  "module": "lib/index",
  "react-native": "src/index",
  "source": "src/index",
  "types": "lib/index.d.ts",
  "peerDependencies": {
    "react": "*",
    "react-native": "*",
    "react-native-nitro-modules": "*"
  }
}
```

## Common Pitfalls

- **Running `nitrogen init` from wrong directory** — Run from the monorepo root, not inside `packages/`
- **Forgetting to add package to workspaces** — Without this, `bun install` won't link the package
- **Name collisions** — Check npm before choosing a name (`npm info react-native-<name>`)
- **Not running `bun install` after scaffold** — Dependencies won't be linked until you do

## Related Skills

- [repo-structure-and-workflow.md](repo-structure-and-workflow.md) — Choose repo layout, config placement, CI, and workflow policy
- [spec-hybrid-object.md](spec-hybrid-object.md) — Next step: write the TypeScript spec
- [spec-nitro-json.md](spec-nitro-json.md) — Configure autolinking before running nitrogen
