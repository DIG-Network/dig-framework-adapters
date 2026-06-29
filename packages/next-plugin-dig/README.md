# @dignetwork/next-plugin-dig

A **Next.js static-export adapter** that makes **DIG** a first-class deploy target. Build with Next,
deploy the static export to a DIG **capsule** — a network no host can read, change, or take down — on
**Chia**.

It does two things:

1. **Dev wallet, for free.** Helpers inject the **`@dignetwork/dig-sdk`** `window.chia` **dev shim**
   into your app `<head>` during `next dev` — the *same* injected-provider contract the SDK's
   `ChiaProvider` detects in production — so you can develop the wallet path without the **DIG
   Browser** or an extension. The shim guards on a real wallet (the DIG Browser always wins) and
   never fakes a signature.
2. **Publish to a capsule.** `digDeploy()` ships your **static export** (`out/`) to a DIG capsule via
   `digstore deploy`, printing the `chia://` / DIGHub URL. Publishing spends **$DIG**, so it is a
   deliberate `publish` step — never part of `next build`.

```bash
npm i -D @dignetwork/next-plugin-dig
```

> **Static export only.** DIG hosts a static, content-addressed capsule (no server runtime), so your
> Next app must use [`output: "export"`](https://nextjs.org/docs/app/building-your-application/deploying/static-exports).
> Server components/handlers, ISR, and image optimization that need a server aren't available on a
> static capsule.

## Quickstart

**1. Configure static export** in `next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
export default {
  output: "export", // writes the static site to out/
};
```

**2. Inject the dev wallet** in your root layout, gated on dev so it never ships to production:

```tsx
// app/layout.tsx
import Script from "next/script";
import { digNextDevShimScript } from "@dignetwork/next-plugin-dig";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {process.env.NODE_ENV !== "production" && (
          <Script id="dig-dev-wallet" dangerouslySetInnerHTML={{ __html: digNextDevShimScript() }} />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
```

Run `next dev` and your app now has a `window.chia` to develop against (a clearly-fake mock address
that refuses to sign — so you always know it's the dev stub).

**3. Add your store config** to `dig.toml`:

```toml
store-id   = "<your 64-hex store id>"
output-dir = "out"            # Next's static-export dir (the adapter's default)
message    = "deploy from next"
```

**4. Add a `publish` script** that builds, then deploys:

```jsonc
// package.json
{
  "scripts": {
    "deploy": "next build && node -e \"import('@dignetwork/next-plugin-dig').then(m=>m.digDeploy())\""
  }
}
```

```bash
export DIGSTORE_DEPLOY_KEY=<from `digstore deploy-key export`>
npm run deploy
```

`digDeploy()` defaults `outputDir` to `out`, reads `dig.toml` + `DIGSTORE_*` env, then runs
`digstore deploy --json` to advance the on-chain root, stage `out/`, and push the new capsule. It
returns `{ capsule, storeId, root, digUrl, hubUrl, pushed }`.

> **Prereq:** `digstore` must be installed and on `PATH` (the canonical deployer — the adapter never
> hand-rolls a deploy or a spend). See the [install docs](https://docs.dig.net/docs/).

## API

### Dev shim

| Helper | Returns | Use |
|---|---|---|
| `digNextDevShimScript(options?)` | the eval-free script **body** (no `<script>` tags) | Next's `<Script dangerouslySetInnerHTML>` or a custom `_document`. |
| `digNextDevShimTag(options?)` | a ready `<script>…</script>` string | raw HTML injection. |

`options.address` sets the mock receive address the shim returns. Always gate on
`process.env.NODE_ENV !== "production"`.

### `digDeploy(options?, deps?): Promise<DeployResult>`

Deploy the static export. Call from a `publish` script after `next build`. Defaults `outputDir` to
`out`; an explicit `outputDir` (or `DIGSTORE_OUTPUT_DIR` / `dig.toml`'s `output-dir`) overrides it.
Other options: `storeId`, `message`, `network`, `remote`, `waitTimeout`, `cwd`, `digstoreBin`.
Precedence is `options > DIGSTORE_* env > dig.toml > default`. On failure it throws a coded
`DigAdapterError`.

### `version()` / `capabilities()`

```ts
import { version, capabilities } from "@dignetwork/next-plugin-dig";
version();        // "0.1.0"
capabilities();   // { name, version, framework: "next", exportDir: "out", features, errorCodes, docs }
```

## Error codes

The publish path always throws a `DigAdapterError` with a stable `.code`:

| Code | When |
|---|---|
| `DIGSTORE_NOT_FOUND` | `digstore` is not installed / not on `PATH`. |
| `DEPLOY_FAILED` | `digstore deploy` exited non-zero. |
| `DEPLOY_OUTPUT_UNPARSEABLE` | `digstore deploy --json` output couldn't be parsed into a capsule. |
| `INVALID_ARGUMENT` | A malformed argument. |

```ts
import { digDeploy, isDigAdapterError } from "@dignetwork/next-plugin-dig";
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
