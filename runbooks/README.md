# dig-framework-adapters — runbook

Operational guide for **releasing (deploying)** and **running locally** this monorepo. It publishes
two npm packages — `@dignetwork/vite-plugin-dig` and `@dignetwork/next-plugin-dig` — so "deploy" here
means "publish to npmjs", not a site/S3 deploy.

For what the packages DO and how a consumer uses them, read the root `README.md`, each package's
`README.md`, and `SPEC.md`. This runbook is only the ops procedures.

---

## 1. Deployment (release → publish to npmjs)

### What triggers a publish

Releases are **tag-driven** (CLAUDE.md §3.6, per-merge-tag group — this is `modules/dx`, NOT a
`modules/apps` nightly repo). The flow is fully automated once a PR merges:

1. **PR merges to `main`** with the `package.json` version already bumped (both packages + the root
   are kept at the SAME version; the version-increment gate blocks a merge that did not bump).
2. **`release.yml`** runs on push-to-`main`: it regenerates `CHANGELOG.md` from Conventional Commits
   with git-cliff, commits it as `chore(release): vX.Y.Z`, then tags that commit `vX.Y.Z` and pushes
   both. It is idempotent — a no-op if `vX.Y.Z` already exists, and it skips its own `chore(release):`
   commit (loop guard).
3. **The pushed `v*` tag** (and the GitHub Release) triggers **`publish-npm.yml`**, which runs
   `npm ci` → `npm run typecheck` → `npm run build` → upgrades npm → `npm publish --workspaces
   --access public`. The root package is `private: true` and is skipped.

Do **NOT** hand-push tags or hand-run `npm publish` — the workflows own tagging + publishing.

### Credentials / secrets

- **`RELEASE_TOKEN`** (org/repo secret, a classic PAT) — used by `release.yml` to push the changelog
  commit + tag. A `GITHUB_TOKEN`-pushed tag does NOT trigger `publish-npm.yml` (GitHub
  anti-recursion), and the PAT identity is allowed past branch protection (`enforce_admins` off). If
  missing, the changelog/tag step cannot push — releases stall.
- **npm publish auth = Trusted Publishing (OIDC), no `NPM_TOKEN`.** `publish-npm.yml` requests
  `id-token: write`; npm exchanges the GitHub Actions OIDC token for a short-lived publish token and
  attaches provenance automatically. The npm-side trusted publisher MUST be configured for org
  `DIG-Network`, repo `dig-framework-adapters`, workflow `publish-npm.yml`. If publishing 403s,
  verify that trusted-publisher config first (it is the usual cause, not a rotated token).

### Verify the release went live

- **Actions:** `release.yml` green (tag pushed) → `publish-npm.yml` green (both packages published).
- **npm:** `npm view @dignetwork/vite-plugin-dig version` and
  `npm view @dignetwork/next-plugin-dig version` both report the new `X.Y.Z`.
- **Tag + changelog:** `git tag -l 'v*' | tail` shows `vX.Y.Z`; `CHANGELOG.md` on `main` has the
  section.

### Publish troubleshooting

- **`publish-npm.yml` fails on npm version** — Trusted Publishing needs npm CLI ≥ 11.5.1; Node 22
  bundles npm 10. The workflow upgrades npm globally AFTER typecheck+build (upgrading earlier has
  broken the workspaces' nested `npm run` on Node 22 runners). Keep that ordering.
- **A package version already exists on npm** — npm rejects a republish of the same version. Bump the
  version in a new PR; never force-republish.
- **Release stalled after merge** — check `RELEASE_TOKEN` is present + valid; the tag-push step is
  where a missing PAT surfaces.

---

## 2. Running locally (develop + test)

### Prerequisites

- **Node ≥ 18** (CI matrix: 18 and 20; `publish-npm.yml` uses 22 — all supported). npm ships with
  Node.
- No global tooling required — `digstore` is only needed to exercise a REAL publish; the unit tests
  stub it, so local dev/test does not need it installed.

### Install + the core loop

```bash
npm ci                 # reproducible install of both workspaces (use `npm install` when changing deps)
npm run typecheck      # tsc --noEmit across both packages
npm run build          # tsup → ESM + CJS + .d.ts for both packages
npm test               # build + node:test for both
npm run test:coverage  # build + run tests under c8 (CI-gated at >=80% lines/branches/funcs/statements)
npm run verify         # typecheck + build + test (the fast pre-push check)
```

Coverage is measured with **c8** over the BUILT output mapped back to `src` (each package's
`.c8rc.json`, `check-coverage: true`, floor 80). `npm run build` runs before every test script
because the tests import the compiled `dist/`.

### Work on a single package

```bash
npm run build -w @dignetwork/vite-plugin-dig
npm test    -w @dignetwork/next-plugin-dig
```

### Match CI exactly before pushing

CI (`.github/workflows/ci.yml`, Node 18 + 20) runs `npm ci` → `npm run typecheck` → `npm run build` →
`npm run test:coverage`. Run those four locally to reproduce a CI result. `commitlint.yml` +
`ensure-version-increment.yml` gate the PR — use Conventional-Commit messages and bump the version.

### Clean up

`dist/`, `coverage/`, `.nyc_output/` are git-ignored build artifacts — delete them (or
`git clean -fdX`) when done; never commit them.
