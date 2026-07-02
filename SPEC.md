# dig-framework-adapters — normative specification

This is the authoritative contract for the two published packages in this monorepo:

- **`@dignetwork/vite-plugin-dig`** — a Vite plugin.
- **`@dignetwork/next-plugin-dig`** — a Next.js static-export adapter.

An independent reimplementation MUST behave as described here. Keywords **MUST**, **MUST NOT**,
**SHOULD**, and **MAY** are used in the RFC 2119 sense. Field/type names are the exported public
surface and are stable contracts.

Both packages are thin composition layers over `@dignetwork/dig-sdk/adapters`. All deploy execution
(advancing the on-chain root, staging, pushing the capsule) is performed by `digstore deploy`, the
canonical deployer; these packages MUST NOT hand-roll a deploy, a spend bundle, or a config
resolution that disagrees with the SDK/CLI.

---

## 1. Scope and roles

Each package performs exactly two jobs, expressed the way its framework expects:

1. **Dev wallet shim (dev only).** Inject the SDK's eval-free `window.chia` dev shim into the app's
   HTML during the dev server, so a plain browser (no DIG Browser, no extension) has an injected
   provider satisfying the same contract `@dignetwork/dig-sdk`'s `ChiaProvider` detects in
   production.
2. **Publish/deploy (opt-in).** Expose `digDeploy()` — called from a `publish` script AFTER the
   framework build — that ships the already-built output to a DIG capsule via `digstore deploy
   --json`, returning the parsed capsule result.

Deploy spends **$DIG**; it MUST be a deliberate, credentialed step and MUST NOT be wired into the
default framework build.

The framework runtime is an **optional** peer dependency in both packages: neither package imports
anything from `vite`/`next` at runtime (Vite only its types, erased at build). Both MUST build and
load with the framework absent.

---

## 2. Package: `@dignetwork/vite-plugin-dig`

### 2.1 `digVite(options?): VitePluginLike`

Returns a structurally-valid Vite plugin object. The returned object MUST have exactly these
observable properties:

| Property | Value | Semantics |
|---|---|---|
| `name` | `"dignetwork:vite-plugin-dig"` | Stable plugin id. |
| `apply` | `"serve"` | The plugin applies to the dev server only; the dev shim is meaningless for a production build. |
| `transformIndexHtml` | `{ order: "pre", handler }` | Injects the dev shim at the earliest HTML-transform point. |

`DigVitePluginOptions`:

| Field | Type | Default | Meaning |
|---|---|---|---|
| `devWallet` | `boolean` | `true` | When `false`, disable shim injection entirely. |
| `devWalletOptions` | `DevShimOptions` | `{}` | Forwarded to `devShimScript` (e.g. the mock `address`). |

`transformIndexHtml.handler(html) -> string` MUST:

- Return `html` unchanged when `devWallet === false`.
- Otherwise inject `\n<script>${shim}</script>\n` where `shim` is `devShimScript(devWalletOptions)`.
- Inject the tag **immediately after** the first `<head>` occurrence when present, so `window.chia`
  exists before app code runs. When there is no `<head>`, the tag MUST be **prepended** to the HTML.

### 2.2 Deploy surface

`digVite` does NOT deploy. Deploy is `digDeploy()` — see §4.

---

## 3. Package: `@dignetwork/next-plugin-dig`

Next has no `transformIndexHtml` hook, so the dev shim is surfaced as helpers the app wires into its
`<head>` (gated on `process.env.NODE_ENV !== "production"`).

### 3.1 `digNextDevShimScript(options?: DevShimOptions): string`

Returns the raw dev-shim script **body** (no surrounding `<script>` tags), for use with Next's
`<Script dangerouslySetInnerHTML>` or a custom `_document`. It MUST equal `devShimScript(options)`.

### 3.2 `digNextDevShimTag(options?: DevShimOptions): string`

Returns a ready-to-inline `` `<script>${devShimScript(options)}</script>` `` string. It MUST start
with `<script>` and end with `</script>` and contain the shim body.

### 3.3 Static-export directory

The Next static export (`next build` with `output: "export"`) writes to `out/`. The constant
`NEXT_EXPORT_DIR` is `"out"` and is the single source of truth shared by the deploy default (§4.2)
and `capabilities().exportDir`.

---

## 4. `digDeploy()` — the publish hand-off (both packages)

```ts
digDeploy(options?: DigDeployOptions, deps?: DigDeployDeps): Promise<DeployResult>
```

`DigDeployOptions` extends the SDK `RunDeployOptions` (§4.4). `DigDeployDeps` is a test/extension
seam:

| Field | Type | Default | Meaning |
|---|---|---|---|
| `runner` | `(opts: RunDeployOptions) => Promise<SdkDeployResult>` | the SDK's `runDeploy` | Override the deploy runner. |

### 4.1 Common contract

`digDeploy` MUST:

1. Select `run = deps.runner ?? runDeploy`.
2. Invoke `run(...)` with `skipBuild: true` merged over the caller's options (the adapter already
   ran the framework build, so `digstore` MUST stage the existing output dir and MUST NOT rebuild).
3. Normalize the runner's result via §5 and return the normalized `DeployResult`.
4. On any thrown value from the runner, throw the mapped `DigAdapterError` from §6 (`toAdapterError`)
   — never leak an uncoded error.

### 4.2 Next-specific default

`@dignetwork/next-plugin-dig`'s `digDeploy` MUST default `outputDir` to `NEXT_EXPORT_DIR` (`"out"`)
when the caller did not supply `outputDir`. An explicit `outputDir` (from options, or resolved from
`DIGSTORE_OUTPUT_DIR` / `dig.toml`) MUST override the default.

`@dignetwork/vite-plugin-dig`'s `digDeploy` MUST NOT inject an `outputDir` default; it forwards the
caller's options unchanged except for `skipBuild: true`.

### 4.3 Option forwarding

Every field the caller passes in `options` (e.g. `storeId`, `outputDir`, `cwd`, `digstoreBin`,
`message`, `network`, `remote`, `waitTimeout`) MUST reach the runner unchanged, except `skipBuild`
(forced `true`) and — for Next only — the `outputDir` default described in §4.2.

### 4.4 `RunDeployOptions` (from `@dignetwork/dig-sdk/adapters`)

| Field | Type | Default | Meaning |
|---|---|---|---|
| `cwd` | `string` | `process.cwd()` | Project root holding `dig.toml` and the build output. |
| `digstoreBin` | `string` | `"digstore"` | The digstore binary name/path to spawn. |
| `storeId` | `string` | from `dig.toml`/env | Target store identity (64-hex). |
| `outputDir` | `string` | see §4.2 | Directory staged into the capsule. |
| `buildCommand` | `string` | — | Ignored on the adapter path (build already ran; `skipBuild` suppresses it). |
| `message` | `string` | — | Commit message for the new capsule. |
| `network` | `string` | digstore default | Chia network selector. |
| `remote` | `string` | — | The `origin` remote to publish to (e.g. `dig://<storeId>`). |
| `waitTimeout` | `number` | — | Seconds to wait for confirmation. |
| `skipBuild` | `boolean` | forced `true` by the adapter | Stage the existing output dir; do not rebuild. |

### 4.5 Config resolution precedence

Config MUST resolve in the precedence the SDK/CLI uses, highest wins:

```
digDeploy() options  >  DIGSTORE_* env  >  dig.toml  >  built-in default
```

Recognized `dig.toml` keys: `store-id`, `output-dir`, `build-command`, `message`, `network`,
`remote`, `wait-timeout`. Recognized env: `DIGSTORE_*` for the above.

### 4.6 Secrets

Deploy **secrets** — the deploy key (`DIGSTORE_DEPLOY_KEY`) and a private-store salt
(`DIGSTORE_STORE_SALT`) — MUST come from the environment ONLY. They MUST NOT be accepted as
`digDeploy` options, MUST NOT be placed on the `digstore` argv, and MUST NOT be written to a config
file. (They are passed to the child process out-of-band via the env overlay so they never appear in
the process table.)

---

## 5. `DeployResult` normalization

`normalizeDeployResult(result: SdkDeployResult): DeployResult` derives the canonical content-open URL
and is **idempotent**.

`DeployResult` (the adapter's returned shape) fields:

| Field | Type | Meaning |
|---|---|---|
| `capsule` | `string` | `storeId:rootHash` — the capsule identity a user shares. |
| `storeId` | `string` | Store identity (64-hex). |
| `root` | `string` | The new on-chain root (64-hex). |
| `chiaUrl` | `string` | The user-facing content-open address `chia://<storeId>:<rootHash>/`. |
| `digUrl` | `string` | **Deprecated** alias carrying the SAME `chia://` value as `chiaUrl` (never a `dig://` URL). |
| `hubUrl` | `string` | The DIGHUb "view it" URL. |
| `pushed` | `boolean?` | Whether the capsule was pushed to DIGHUb, when reported. |

Normalization rules:

- If the runner's result already carries a non-empty string `chiaUrl`, that value MUST be preserved
  as `chiaUrl` (byte-identical to the CLI/SDK).
- Otherwise `chiaUrl` MUST be derived as `` `chia://${result.storeId}:${result.root}/` ``.
- `digUrl` in the returned result MUST be set to the SAME value as `chiaUrl`. The adapter MUST NEVER
  return a `dig://` value in `chiaUrl` or `digUrl`.
- All other fields pass through unchanged.

**Rationale / cross-repo contract.** The user-facing "open this capsule" scheme is `chia://` (see
`SYSTEM.md` → Canonical terminology & branding; the scheme the DIG Browser / extension register).
`chiaUrl` MUST match `digstore deploy`'s printed `content_address` exactly. The `dig://<host>/<store_id>`
remote-transport locator and the `urn:dig:` namespace are a different concern and legitimately stay
`dig://`; they are not produced by this normalization.

---

## 6. Error taxonomy

Every failure `digDeploy()` surfaces MUST be a `DigAdapterError` (an `Error` subclass) carrying a
stable machine `code`. Callers branch on `.code`, not the human message.

### 6.1 `DIG_ADAPTER_ERROR_CODES`

A frozen, self-keyed catalogue (`key === value`). The `DigAdapterErrorCode` union is its value set.

| Code | Meaning |
|---|---|
| `DIGSTORE_NOT_FOUND` | The `digstore` binary could not be spawned (not installed / not on PATH). |
| `DEPLOY_FAILED` | `digstore deploy` exited non-zero (on-chain root advance / push failed). |
| `DEPLOY_OUTPUT_UNPARSEABLE` | `digstore deploy --json` output could not be parsed into a capsule result. |
| `INVALID_ARGUMENT` | An argument was malformed (e.g. non-hex store id, mutually-exclusive options). |

### 6.2 `DigAdapterError`

| Member | Type | Meaning |
|---|---|---|
| `name` | `"DigAdapterError"` | Constant. |
| `code` | `DigAdapterErrorCode` | The stable machine code. |
| `context` | `DigAdapterErrorContext` | Structured, code-specific detail (all fields optional; open-ended). |
| `cause` | `unknown?` | The underlying error, when one was mapped. |
| `toJSON()` | `{ code, message, context }` | JSON-friendly view for machines. |

`DigAdapterErrorContext` recognized fields (all optional): `bin` (string), `exitCode`
(`number | null`), `value` (string), plus arbitrary additional keys.

### 6.3 `isDigAdapterError(e, code?)`

Returns `true` iff `e instanceof DigAdapterError` and, when `code` is given, `e.code === code`;
`false` otherwise.

### 6.4 `toAdapterError(e): DigAdapterError`

Mapping rules, in order:

1. If `e` is already a `DigAdapterError`, return it unchanged.
2. Compute `message = e instanceof Error ? e.message : String(e)`.
3. If `e` is an object whose `.code` is a string present in `DIG_ADAPTER_ERROR_CODES`, use that code
   (honor an already-coded SDK error).
4. Else classify by `message` (case-insensitive):
   - matches `is digstore installed | could not run | not on PATH | ENOENT` → `DIGSTORE_NOT_FOUND`;
   - matches `could not parse | did not report a capsule | malformed capsule` →
     `DEPLOY_OUTPUT_UNPARSEABLE`;
   - otherwise → `DEPLOY_FAILED`.
5. Return `new DigAdapterError(code, message, {}, { cause: e })`.

---

## 7. Self-description (agent-friendly introspection)

Both packages export `version()`, `capabilities()`, and `describe = capabilities`.

### 7.1 `version(): string`

Returns the package semver. It MUST be injected at build time from `package.json` (tsup `define`
`__PLUGIN_VERSION__`) so it can never drift from the published version. The unbundled/test fallback
is `"0.0.0-dev"`.

### 7.2 `capabilities(): PluginCapabilities`

| Field | Value | Notes |
|---|---|---|
| `name` | `"@dignetwork/vite-plugin-dig"` / `"@dignetwork/next-plugin-dig"` | Package name. |
| `version` | `= version()` | Build-injected semver. |
| `framework` | `"vite"` / `"next"` | The framework targeted. |
| `features` | `["dev-wallet-shim", "publish-deploy"]` | Advertised capabilities. |
| `exportDir` | `"out"` | **next only** — the static-export dir. |
| `errorCodes` | `Object.values(DIG_ADAPTER_ERROR_CODES)` | The stable error catalogue. |
| `docs` | `"https://docs.dig.net/docs/audiences/app-developers"` | The verified app-developer docs landing. |

The `docs` value MUST resolve to a live docs.dig.net route.

---

## 8. Dev-shim contract (from the SDK)

The injected shim (`devShimScript`) is generated by `@dignetwork/dig-sdk/adapters`. The adapters
inject it verbatim and depend on these properties, which the SDK guarantees and the adapters' tests
assert:

- It defines `window.chia` **only if** one is not already present, so a real DIG Browser / extension
  always wins.
- It is **eval-free** (no `eval(`, no `new Function(`) — safe under a strict CSP (no `unsafe-eval`).
- It carries the literal marker `DEV_SHIM_MARKER` (`"dig-sdk:dev-wallet-shim"`) identifying it as a
  dev stub.
- It refuses to fabricate a real signature (a dev stub must never mislead).
- `DevShimOptions.address` sets the mock receive address returned from `getAddress`.

---

## 9. Invariants

- **Thin composition.** The adapters MUST reuse the SDK core (dig.toml reader, config resolution,
  dev-shim generator, deploy runner). They MUST NOT re-implement deploy, spend construction, or a
  divergent config resolution.
- **Deploy is opt-in.** `digDeploy` MUST NOT be invoked as part of the framework build; it is called
  explicitly from a `publish` script after the build.
- **`skipBuild` is forced.** The adapter path always sets `skipBuild: true` (the framework already
  built).
- **chia:// only.** The returned `chiaUrl`/`digUrl` are always `chia://…`, never `dig://…`.
- **Optional framework peer.** Neither package imports the framework runtime; both build/load
  without it installed.

---

## 10. Build, packaging, and runtime

- Each package builds with **tsup** to ESM (`dist/index.js`) + CJS (`dist/index.cjs`) + type
  declarations (`dist/index.d.ts`, `dist/index.d.cts`) + source maps.
- Output is **eval-free** (CSP-safe) and targets **Node ≥ 18**.
- `@dignetwork/dig-sdk` is an external runtime **dependency** (never bundled); `vite`/`next` are
  optional peers.
- The `exports` map exposes `.` (types/import/require) and `./package.json`. Published files:
  `dist`, `README.md`, `LICENSE`.
- `version()` is injected via tsup `define` `__PLUGIN_VERSION__ = JSON.stringify(pkg.version)`.

---

## 11. Testing and coverage

- Unit tests drive the built `dist/` (`node --test`), mocking the framework/deploy boundary (the
  `runner` seam and the `transformIndexHtml` hook) — no real `digstore` spawn, no $DIG spent.
- Coverage is measured with **c8** over `dist/**` mapped back to `src` via source maps, and is
  **CI-gated at ≥ 80%** lines/branches/functions/statements per package (`.c8rc.json`,
  `check-coverage: true`). A build below the floor FAILS.
- Behavior changes require a test that would fail without the change; bugs require a regression test
  first.

---

## 12. Conformance notes (cross-repo)

- The `chia://<storeId>:<rootHash>/` content-open form and the store/capsule vocabulary MUST match
  `SYSTEM.md` → Canonical terminology & branding and the docs.dig.net app-developer docs.
- `chiaUrl` MUST equal `digstore deploy`'s printed `content_address` byte-for-byte.
- The config resolution precedence (§4.5) and secret handling (§4.6) MUST match `digstore`'s own
  behavior so the adapters can never disagree with the CLI.
- The `DeployResult` shape (§5) is the SDK's `DeployResult` augmented only by guaranteeing `chiaUrl`
  is populated; it MUST stay assignable to the SDK type.
