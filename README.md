# DIG framework adapters

Make **DIG** a first-class deploy target for the frameworks you already use. Build your app with
**Vite** or **Next.js**, then ship it to a DIG **capsule** — a network no host can read, change, or
take down — on **Chia**.

This repo is a small monorepo with two published packages:

| Package | What it is | Install |
|---|---|---|
| [**`@dignetwork/vite-plugin-dig`**](packages/vite-plugin-dig#readme) | A Vite plugin: injects a `window.chia` dev wallet during `vite dev`, and ships your build to a DIG capsule on `publish`. | `npm i -D @dignetwork/vite-plugin-dig` |
| [**`@dignetwork/next-plugin-dig`**](packages/next-plugin-dig#readme) | A Next.js **static-export** adapter: the same dev wallet shim + a `publish` step that ships `out/` to a DIG capsule. | `npm i -D @dignetwork/next-plugin-dig` |

Both do the same two things, the way each framework expects:

1. **Dev wallet, for free.** During `dev` they inject the **`@dignetwork/dig-sdk`** `window.chia`
   **dev shim** — the *same* injected-provider contract the SDK's `ChiaProvider` detects in
   production — so you can build and exercise the wallet path locally without the **DIG Browser** or
   an extension. The shim guards on a real wallet (so the DIG Browser always wins) and refuses to
   fake a signature, so a dev is never misled.
2. **Publish to a capsule.** A `digDeploy()` you call from a `publish` script ships your **built**
   output to a DIG **capsule** via `digstore deploy`, printing the `chia://` / DIGHub URL. Publishing
   spends **$DIG**, so it is a deliberate, credentialed step — never part of the default build.

> **Concepts.** A **store** is your app's on-chain identity; a **capsule** (`storeId:rootHash`) is
> one immutable published version of it. `chia://` is what a user clicks to open your verified app.
> Read more in the [DIG docs](https://docs.dig.net/docs/).

## How it fits together

These adapters are **thin**. All the heavy lifting lives in two places they compose:

- **[`@dignetwork/dig-sdk`](https://www.npmjs.com/package/@dignetwork/dig-sdk)** — the adapters reuse
  its proven, tested core (the `dig.toml` reader, `options > env > dig.toml > default` config
  resolution, the eval-free dev-shim generator, and the `digstore deploy` runner). They are a
  `dependency`, so installing an adapter pulls the SDK in for you.
- **[`digstore`](https://docs.dig.net/docs/)** — the canonical deployer. `digDeploy()` shells out to
  `digstore deploy --json`, which advances the on-chain root, stages your build dir, and pushes the
  new capsule to DIGHub. **The adapters never hand-roll a deploy or a spend.**

```
your app  ──vite build / next build──▶  out dir
                                          │  digDeploy()  (publish script)
                                          ▼
                              digstore deploy --json  ──▶  new capsule  ──▶  chia:// + DIGHub URL
```

Config (`store-id`, `output-dir`, `build-command`, `message`, `network`, `remote`, `wait-timeout`)
is read from your project's **`dig.toml`**, overridable by `DIGSTORE_*` env and by the `digDeploy()`
options, in that precedence — exactly the order `digstore` itself uses, so the adapters can never
disagree with the CLI. Secrets (the deploy key, a private-store salt) come from **env only**
(`DIGSTORE_DEPLOY_KEY`, `DIGSTORE_STORE_SALT`) so they never end up on the command line or in a
checked-in file.

Prefer it inside the SDK instead? `@dignetwork/dig-sdk/vite` and `@dignetwork/dig-sdk/next` expose
the same helpers from the SDK directly. These standalone packages are the framework-named home with a
stable error taxonomy + `version()`/`capabilities()` introspection on top.

## Quickstart

See each package's README for the full quickstart:

- **Vite** → [`packages/vite-plugin-dig`](packages/vite-plugin-dig#readme)
- **Next.js** → [`packages/next-plugin-dig`](packages/next-plugin-dig#readme)

## Agent-friendly

Both packages are built for automated consumers as well as humans:

- **Typed exports + `.d.ts`** — every option, result, and error type is declared (no `any`).
- **Stable error codes.** The publish path always throws a coded `DigAdapterError` (`.code` is one of
  `DIGSTORE_NOT_FOUND`, `DEPLOY_FAILED`, `DEPLOY_OUTPUT_UNPARSEABLE`, `INVALID_ARGUMENT`) — branch on
  the code, not the message. The catalogue is exported as `DIG_ADAPTER_ERROR_CODES`.
- **Self-description.** `version()` returns the package semver (build-time injected, never drifts);
  `capabilities()` (alias `describe()`) returns the framework, features, error codes, and docs link
  as machine-readable data.

## Develop

```bash
npm install          # installs both workspaces
npm run build        # build both packages (ESM + CJS + .d.ts)
npm test             # build + run node:test for both
npm run verify       # typecheck + build + test
```

Each package builds with **tsup** to ESM + CJS + `.d.ts`, is **eval-free** (CSP-safe), and runs on
**Node 18+**.

## License

MIT — see [LICENSE](LICENSE).
