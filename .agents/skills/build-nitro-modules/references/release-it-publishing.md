---
title: One-Command Releases with release-it
impact: MEDIUM
tags: release-it, bun-release, npm-publish, changelog, github-release, lockfiles
---

# Skill: One-Command Releases with release-it

Use this when setting up or reviewing package releases. The repo should expose one command:

```bash
bun release
```

Use `release-it`. Do not require maintainers to remember separate npm publish, tag, changelog, lockfile, and GitHub release commands.

## Single Package

For a single-package repo where the root package is the publishable package, the package can run `release-it` directly and own npm publishing:

```json
{
  "scripts": {
    "release": "release-it"
  },
  "devDependencies": {
    "@release-it/conventional-changelog": "^11.0.0",
    "release-it": "^20.0.0"
  },
  "release-it": {
    "npm": {
      "publish": true
    },
    "github": {
      "release": true
    },
    "plugins": {
      "@release-it/conventional-changelog": {
        "preset": "conventionalcommits"
      }
    }
  }
}
```

## Multiple Packages

For workspaces, release from the root with `bun release`. Use this pattern for multiple publishable packages, and also for one publishable package inside `packages/` when the root needs to version examples, changelogs, tags, GitHub releases, or lockfiles:

- Each package has `"release": "release-it"` and package-level `release-it` config with `"npm.publish": true`, `"git": false`, and `"github.release": false`.
- The root `"release": "./scripts/release.sh"` script runs each package release sequentially, then runs root `release-it`.
- Root `release-it` owns the version bump commit, tag, changelog, and GitHub release, with `"npm.publish": false`.
- Root `release-it.git.requireCleanWorkingDir` must be `false`; package releases and lockfile updates create diffs before the root release commit.
- After the root version bump and before the release commit, refresh and stage lockfiles. Run `bun install` for `bun.lock`, and run the example app's bundle/pod install so `Podfile.lock` is current. Use the `release-it` hook that runs in that window for the repo, such as `after:bump` or `before:git`.

Root script pattern:

```bash
#!/bin/bash
set -e

for pkg in packages/*; do
  [ -d "$pkg" ] || continue
  (cd "$pkg" && bun release "$@")
done

bun run release-it "$@"
```

Root release config shape:

```json
{
  "scripts": {
    "release": "./scripts/release.sh"
  },
  "devDependencies": {
    "@release-it/bumper": "^7.0.0",
    "@release-it/conventional-changelog": "^11.0.0",
    "release-it": "^20.0.0"
  },
  "release-it": {
    "npm": {
      "publish": false
    },
    "git": {
      "commitMessage": "chore: release ${version}",
      "tagName": "v${version}",
      "requireCleanWorkingDir": false
    },
    "github": {
      "release": true
    },
    "hooks": {
      "before:release": "bun install && bun run build && bun specs",
      "after:bump": "bun install && git add bun.lock && bun example bundle-install && bun example pods && git add apps/example/ios/Podfile.lock"
    },
    "plugins": {
      "@release-it/bumper": {
        "out": [
          {
            "file": "packages/react-native-math/package.json",
            "path": "version"
          },
          {
            "file": "apps/example/package.json",
            "path": "version"
          }
        ]
      },
      "@release-it/conventional-changelog": {
        "preset": "conventionalcommits"
      }
    }
  }
}
```

Adapt the lockfile hook to the actual example layout, such as `example/ios/Podfile.lock` for top-level `example/`.

## Common Pitfalls

- **No `bun release` alias** — Releases must use one command.
- **Root clean-working-tree checks in monorepos** — Set root `release-it.git.requireCleanWorkingDir` to `false` when package releases run before the root release commit.
- **Stale lockfiles after version bumps** — Refresh and stage `bun.lock` and the example app's `Podfile.lock` after the root bump and before root `release-it` creates the release commit.
- **Mixed responsibilities** — Package release configs publish npm packages. Root release config creates the git commit, tag, changelog, and GitHub release.
