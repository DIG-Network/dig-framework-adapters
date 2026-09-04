# Contributing to dig-framework-adapters

Thanks for your interest in improving the DIG framework adapters. This repo is a small npm
monorepo with two published packages — please read this before opening a PR.

## What this repo is

A Vite plugin (`@dignetwork/vite-plugin-dig`) and a Next.js static-export adapter
(`@dignetwork/next-plugin-dig`) that make DIG a first-class deploy target: a `window.chia` dev
shim during `dev`, and a publish step that ships the build output to a DIG capsule via
`digstore deploy`.

## Reporting an issue

File it at <https://github.com/DIG-Network/dig-framework-adapters/issues>, with:

- what you observed
- what you expected instead
- steps to reproduce (which package — Vite or Next.js — and your `dig.toml`/config, redacted of
  secrets)

## Prerequisites

- **Node >= 18** (`engines.node` in `package.json`; CI matrices `18` and `20`).
- **npm workspaces** — this is a plain npm monorepo (`"workspaces": ["packages/shared",
"packages/*"]`), not pnpm or yarn. Use `npm`, not another package manager.
- **Build `packages/shared` first.** `@dignetwork/dig-adapters-shared` is an internal, unpublished
  workspace package that both adapters depend on and inline into their own `dist` via tsup. `npm
install` builds it for you automatically (the root `postinstall` script runs `npm run build
--workspace=packages/shared`) — you don't need a separate step, but if you ever see a stale-types
  error from the shared package, rebuild it first: `npm run build --workspace=packages/shared`.

## Build & test

```bash
npm install            # installs all three workspaces; builds packages/shared via postinstall
npm run build          # build every package (ESM + CJS + .d.ts), via `--workspaces --if-present`
npm test               # build + run node:test, every package
npm run test:coverage  # build + run tests under c8 (CI-gated at >=80% per package)
npm run typecheck      # tsc --noEmit, every package
npm run verify         # lint + format:check + typecheck + build + test, root
```

To work on a single package instead of the whole workspace, pass `--workspace`:

```bash
npm run build --workspace=packages/vite-plugin-dig
npm test --workspace=packages/next-plugin-dig
npm run test:coverage --workspace=packages/vite-plugin-dig
```

Each package's own `test`/`test:coverage` script builds itself first, then runs
`node --test test/*.test.mjs` (optionally under `c8`).

## The gate (must pass before a PR is merged)

CI (`.github/workflows/ci.yml`) runs on every push and PR, on Node 18 and Node 20:

```bash
npm ci
npm run lint            # eslint .
npm run format:check    # prettier --check .
npm run typecheck       # both packages
npm run build           # ESM + CJS + .d.ts, both packages
npm run test:coverage   # unit tests + c8 coverage gate (>=80%), both packages
```

Two more required checks run on every PR:

- **Commitlint** (`.github/workflows/commitlint.yml`) — every commit message and the PR title must
  be a Conventional Commit (`commitlint.config.mjs`, extends `@commitlint/config-conventional`).
- **Version increment** (`.github/workflows/ensure-version-increment.yml`) — the root
  `package.json` version must increase over `main`, **and every workspace member's `package.json`
  version must equal the root's**. This repo releases in lockstep: bump the root version and every
  package under `packages/*` (`shared`, `vite-plugin-dig`, `next-plugin-dig`) to the same new
  version in the same PR — the gate fails if any one of them disagrees with the root.

## Pull request conventions

- Branch off up-to-date `main`; `main` is protected (PR required, all checks green, zero
  unresolved review threads, squash-merge only).
- Commit messages and the PR title follow Conventional Commits (`type(scope): summary`) —
  commitlint-enforced. `type` drives the release: `fix` → patch, `feat` → minor, `!`/`BREAKING
CHANGE:` → major.
- Bump the version as part of the PR, per the lockstep rule above.
- On merge, `.github/workflows/release.yml` regenerates `CHANGELOG.md` from your commits
  (git-cliff), tags the resulting commit `vX.Y.Z`, and pushes the tag — which triggers
  `publish-npm.yml` to build and publish `@dignetwork/vite-plugin-dig` and
  `@dignetwork/next-plugin-dig` to npm (`@dignetwork/dig-adapters-shared` stays unpublished;
  `private: true`).

## Where things live

| Package                    | Published?                             | Responsibility                                                                     |
| -------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------- |
| `packages/shared`          | No (`@dignetwork/dig-adapters-shared`) | Error taxonomy + deploy-result normalization shared byte-for-byte by both adapters |
| `packages/vite-plugin-dig` | Yes (`@dignetwork/vite-plugin-dig`)    | The Vite plugin                                                                    |
| `packages/next-plugin-dig` | Yes (`@dignetwork/next-plugin-dig`)    | The Next.js static-export adapter                                                  |

The authoritative contract for both published packages — public API, config resolution, the deploy
hand-off, the `DeployResult` shape, and the error taxonomy — is in [`SPEC.md`](SPEC.md). A behavior
change that leaves `SPEC.md` describing old behavior is incomplete.

See [`runbooks/`](runbooks/README.md) for releasing and running locally.
