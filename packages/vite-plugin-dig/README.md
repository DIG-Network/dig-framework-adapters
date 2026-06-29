# @dignetwork/vite-plugin-dig

A **Vite plugin** that makes **DIG** a first-class deploy target. Build with Vite, deploy to a DIG
**capsule** — a network no host can read, change, or take down — on **Chia**.

It does two things:

1. **Dev wallet, for free.** During `vite dev` it injects the **`@dignetwork/dig-sdk`** `window.chia`
   **dev shim** — the *same* injected-provider contract the SDK's `ChiaProvider` detects in
   production — so you can develop the wallet path without the **DIG Browser** or an extension. The
   shim guards on a real wallet (the DIG Browser always wins) and never fakes a signature.
2. **Publish to a capsule.** `digDeploy()` ships your **built** site to a DIG capsule via
   `digstore deploy`, printing the `chia://` / DIGHUb URL. Publishing spends **$DIG**, so it is a
   deliberate `publish` step — never part of `vite build`.

```bash
npm i -D @dignetwork/vite-plugin-dig
```

## Quickstart

**1. Add the plugin** to `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import { digVite } from "@dignetwork/vite-plugin-dig";

export default defineConfig({
  plugins: [digVite()], // injects the window.chia dev wallet during `vite dev`
});
```

Run `vite dev` and your app now has a `window.chia` to develop against. The SDK's `ChiaProvider`
(`mode: "injected"`) connects to it just like it would the real DIG Browser wallet — except it
returns a clearly-fake mock address and refuses to sign, so you always know it's the dev stub.

**2. Add your store config** to `dig.toml` (run `digstore new` to scaffold one, or write it by hand):

```toml
store-id      = "<your 64-hex store id>"
output-dir    = "dist"          # Vite's default build dir
message       = "deploy from vite"
```

**3. Add a `publish` script** that builds, then deploys:

```jsonc
// package.json
{
  "scripts": {
    "deploy": "vite build && node -e \"import('@dignetwork/vite-plugin-dig').then(m=>m.digDeploy())\""
  }
}
```

```bash
# Secrets come from env, never the command line:
export DIGSTORE_DEPLOY_KEY=<from `digstore deploy-key export`>
# (private store only) export DIGSTORE_STORE_SALT=<hex>
npm run deploy
```

`digDeploy()` reads `dig.toml` + `DIGSTORE_*` env, then runs `digstore deploy --json` to advance the
on-chain root, stage `dist/`, and push the new capsule. It returns:

```ts
{
  capsule: "<storeId>:<rootHash>",                  // the capsule identity you can share
  storeId: "<storeId>",
  root:    "<rootHash>",
  chiaUrl: "chia://<storeId>:<rootHash>/",          // what a user clicks to open your verified app
  digUrl:  "chia://<storeId>:<rootHash>/",          // @deprecated alias of chiaUrl (same value)
  hubUrl:  "https://hub.dig.net/stores/<storeId>",  // the DIGHUb "view it" page
}
```

> **Prereq:** `digstore` must be installed and on `PATH` (the canonical deployer — the plugin never
> hand-rolls a deploy or a spend). See the [install docs](https://docs.dig.net/docs/).

## API

### `digVite(options?): Plugin`

The Vite plugin. Add to `plugins`. Options:

| Option | Type | Default | Meaning |
|---|---|---|---|
| `devWallet` | `boolean` | `true` | Inject the `window.chia` dev shim during `vite dev`. |
| `devWalletOptions.address` | `string` | a clearly-fake dev address | The mock receive address the shim returns from `getAddress`. |

The shim is only injected on the dev server (`apply: "serve"`) — never into a production build.

### `digDeploy(options?, deps?): Promise<DeployResult>`

Deploy the built site. Call from a `publish` script after `vite build`. `options` are the
[`digstore deploy`](https://docs.dig.net/docs/) knobs: `storeId`, `outputDir` (default `dist`),
`message`, `network`, `remote`, `waitTimeout`, plus `cwd` and `digstoreBin`. Config precedence is
`options > DIGSTORE_* env > dig.toml > default`. On failure it throws a coded `DigAdapterError`.

### `version()` / `capabilities()`

```ts
import { version, capabilities } from "@dignetwork/vite-plugin-dig";
version();        // "0.1.0"
capabilities();   // { name, version, framework: "vite", features: [...], errorCodes: [...], docs }
```

## Error codes

The publish path always throws a `DigAdapterError` with a stable `.code` — branch on the code:

| Code | When |
|---|---|
| `DIGSTORE_NOT_FOUND` | `digstore` is not installed / not on `PATH`. |
| `DEPLOY_FAILED` | `digstore deploy` exited non-zero (the on-chain advance / push failed). |
| `DEPLOY_OUTPUT_UNPARSEABLE` | `digstore deploy --json` output couldn't be parsed into a capsule. |
| `INVALID_ARGUMENT` | A malformed argument (e.g. a non-hex store id). |

```ts
import { digDeploy, isDigAdapterError } from "@dignetwork/vite-plugin-dig";
try {
  await digDeploy();
} catch (e) {
  if (isDigAdapterError(e, "DIGSTORE_NOT_FOUND")) console.error("Install digstore first.");
  else throw e;
}
```

The full catalogue is exported as `DIG_ADAPTER_ERROR_CODES`.

## License

MIT.
