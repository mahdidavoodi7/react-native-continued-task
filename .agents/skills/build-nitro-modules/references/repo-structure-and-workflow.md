---
title: Repository Structure and Workflow
impact: HIGH
tags: repo-structure, monorepo, apps, packages, docs, config, ci, workflow
---

# Skill: Repository Structure and Workflow

Use this when creating a new repo, reorganizing a repo, adding examples/docs/CI, or making a large feature that changes package layout.

## Recommended Layout

```
<root>/
├── README.md
├── package.json
├── bun.lock
├── packages/
│   └── react-native-math/
├── apps/
│   └── example/
├── docs/
├── scripts/
├── config/
└── .github/
    └── workflows/
```

## Rules

- Name the default branch `main`. Do not initialize new repos, workflow refs, docs snippets, release config, or branch protection around `master`.
- Keep the root small so `README.md` stays visible in GitHub's file list. Root files should mostly be `README.md`, `package.json`, lockfiles, `packages/`, one example-app location, optional `docs/`, optional `scripts/`, `config/`, `.github/`, and root-only config files required by tools.
- Add `README.md` in the first repo setup pass. Prefer a Margelo-style graphic banner at the top when a real banner asset exists or can be created cleanly; otherwise start with `# <LibraryName>`. Use [VisionCamera](https://github.com/mrousavy/react-native-vision-camera), [Nitro](https://github.com/mrousavy/nitro), and [MMKV](https://github.com/mrousavy/react-native-mmkv) as README reference patterns. The README should quickly show the catchy one-line value proposition, install command, minimal usage, docs/API links, example app link, platform support, and support/community links.
- Put publishable libraries in `packages/<package-name>/`.
- Use `apps/<example-name>/` when the repo may need multiple example apps, including optional native dependencies, feature variants, or integration demos.
- Use top-level `example/` only for intentionally small single-example repos that should preserve React Native's generated paths.
- Keep example apps close to the official React Native template. Use official APIs, generated configs, and template-supported extension points before custom setup.
- Add `docs/` only when `README.md` is not enough. Prefer Fumadocs over Docusaurus for a full docs site, deploy it on Vercel, and use a short Margelo subdomain when appropriate, such as `<simple-name>.margelo.com`.
- Generate API docs from JSDoc with TypeDoc or a similar tool. JSDoc should link related APIs with `{@linkcode ...}`, `@see`, and real docs URLs so users can click through the API reference like Apple-style docs.
- Add `scripts/` only for reusable repo automation.
- Put shared config under `config/` when tools can reference it, including TypeScript configs, lint/format configs, `.swift-format`, `.clang-format`, and `.editorconfig`. If a tool requires a root config file, keep the root file minimal and delegate to `config/`.
- Prefer Bun commands: `bun install`, `bun run`, `bun --cwd`, and `bunx`. Use `npx` only when Bun cannot run the tool.
- Add `.github/workflows/` for CI validation on PRs and pushes to `main`. CI must run TypeScript compilation/build checks and code style checks, including formatting/linting for JS/TS and native code that exists in the repo.
- Prefer `react-native-harness` for GitHub Actions end-to-end tests in a real React Native environment. Do not add standalone native tests such as Kotlin JUnit or XCTest unless the library also exposes a native target outside React Native or the behavior cannot be validated through the React Native API.
- Keep GitHub repository metadata and npm metadata polished for search: catchy description, website, topics/tags, package `description`, `keywords`, `author`/`contributors`, `repository`, `homepage`, `bugs`, and funding/support links when relevant.
- Do not add Husky, commitlint, lint-staged, pre-commit hooks, pre-push hooks, or `prepare` scripts that install hooks. Validation belongs in CI.
- Avoid `patch-package`, postinstall rewrites, monkeypatching, and workaround layers. Fix package layout, autolinking, generated config, official extension points, or upstream issues first. If a patch is unavoidable, keep it narrow, link the upstream issue or PR, and remove it once the root cause is fixed.
- Work on a separate branch and open a draft PR early so CI can run while local work continues.
- Use squash merges for `main`.
- After initial release or after major rewrites settle, keep PRs atomic unless changes are tightly coupled.

## Root Workspace

For `apps/example`:

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

For top-level `example/`, use:

```json
{
  "workspaces": [
    "packages/*",
    "example"
  ],
  "scripts": {
    "example": "bun --cwd example"
  }
}
```

## CI Baseline

Start with:

- TypeScript/build: `bun install --frozen-lockfile`, `bun run typecheck`, `bun run build`, `bun run specs`
- JS lint/format: Biome, or ESLint/Prettier if already used
- Native lint/format for native code in the repo: SwiftLint or swift-format, clang-format or clang-tidy/cpplint, ktlint or Detekt
- End-to-end behavior: `react-native-harness` on GitHub Actions when the feature needs real React Native runtime coverage

## Common Pitfalls

- **Default branch drift** — Do not leave new repos or docs pointing to `master`; use `main`.
- **Weak first impression** — A README without a banner or clear library-name heading, value proposition, install, usage, and links makes the package harder to evaluate and find.
- **Root pollution** — Move config into `config/` when tools support it.
- **Two example locations** — Use either `apps/example` or `example/`, not both.
- **Docs-site sprawl** — Prefer Fumadocs on Vercel for Margelo docs sites instead of adding a heavier docs framework by default.
- **Hook frameworks** — Do not add commit/push hooks; use CI.
- **Native-only tests for RN APIs** — Prefer harness E2E coverage unless there is a standalone native target or RN cannot exercise the behavior.
- **Patch layers** — Avoid patches and postinstall rewrites; when temporary patches are unavoidable, track the upstream fix and keep the patch isolated.
- **Late PRs** — Open a draft PR early so CI runs while implementation continues.
