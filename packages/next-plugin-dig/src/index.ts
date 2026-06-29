// @dignetwork/next-plugin-dig — a Next.js static-export adapter that makes DIG a first-class deploy
// target for Next.
//
// Next has no Vite-style `transformIndexHtml` hook, so the adapter's two jobs are surfaced as
// helpers a Next project wires in:
//   1. DEV: `digNextDevShimScript()` / `digNextDevShimTag()` return the SDK's eval-free `window.chia`
//      dev shim (the SAME injected-provider contract the `@dignetwork/dig-sdk` ChiaProvider detects
//      in production) — drop it into the app `<head>` (e.g. in `app/layout.tsx`), gated on
//      `process.env.NODE_ENV !== "production"` so it ships only in dev. The shim guards on a real
//      wallet (DIG Browser / extension wins) and refuses to fake a signature.
//   2. PUBLISH: `digDeploy()` ships the static-export output (`out/` — what `next build` writes with
//      `output: "export"`) to a DIG capsule via `digstore deploy --json`, printing the chia:// /
//      DIGHub URL. Call it from a `publish` script AFTER the build. Deploy spends $DIG, so it is a
//      deliberate, credentialed step — never part of the default build.
//
// The adapter is intentionally thin: it composes the proven, separately-published
// `@dignetwork/dig-sdk/adapters` core (dig.toml reader, options>env>dig.toml>default config
// resolution, the eval-free dev-shim generator, and the `digstore deploy` runner). All deploy logic
// lives in `digstore deploy`, the canonical deployer; this never hand-rolls a deploy or a spend
// (SYSTEM.md → "Don't hand-roll spends"). `next` is an OPTIONAL peer — this module imports nothing
// from "next", so it builds + loads without Next installed.

import {
  devShimScript,
  runDeploy,
  type DevShimOptions,
  type RunDeployOptions,
  type DeployResult,
} from "@dignetwork/dig-sdk/adapters";
import { toAdapterError } from "./errors.js";
import { NEXT_EXPORT_DIR } from "./export-dir.js";

export { version, capabilities, describe, type PluginCapabilities } from "./capabilities.js";
export {
  DigAdapterError,
  isDigAdapterError,
  DIG_ADAPTER_ERROR_CODES,
  type DigAdapterErrorCode,
  type DigAdapterErrorContext,
} from "./errors.js";
export type { DevShimOptions, DeployResult } from "@dignetwork/dig-sdk/adapters";

/**
 * The raw dev-shim script BODY (no surrounding `<script>` tags) — for callers that inject it
 * themselves (e.g. Next's `<Script id="dig-dev-wallet" dangerouslySetInnerHTML={{ __html: ... }} />`
 * or a custom `_document`). Eval-free (CSP-safe). Gate on dev so it never ships to production.
 *
 * @example
 * // app/layout.tsx
 * import Script from "next/script";
 * import { digNextDevShimScript } from "@dignetwork/next-plugin-dig";
 * // ...
 * {process.env.NODE_ENV !== "production" && (
 *   <Script id="dig-dev-wallet" dangerouslySetInnerHTML={{ __html: digNextDevShimScript() }} />
 * )}
 */
export function digNextDevShimScript(options: DevShimOptions = {}): string {
  return devShimScript(options);
}

/**
 * A ready-to-inline `<script>…</script>` string carrying the dev shim. Prefer
 * {@link digNextDevShimScript} with Next's `<Script>` component when you can; this is for raw HTML
 * injection (e.g. a custom `_document`). Gate on dev.
 */
export function digNextDevShimTag(options: DevShimOptions = {}): string {
  return `<script>${devShimScript(options)}</script>`;
}

/** Options for {@link digDeploy} — all {@link RunDeployOptions} (with `outputDir` defaulting to `out`). */
export interface DigDeployOptions extends RunDeployOptions {}

/** Test/extension seam: the function {@link digDeploy} delegates the actual deploy to. */
export interface DigDeployDeps {
  /** Override the deploy runner (defaults to the SDK's `runDeploy`). Used to test the wiring. */
  runner?: (opts: RunDeployOptions) => Promise<DeployResult>;
}

/**
 * Deploy the Next static export to a DIG capsule. Call from a `publish` npm script AFTER
 * `next build` (with `output: "export"`):
 *
 * ```jsonc
 * // package.json
 * "scripts": {
 *   "deploy": "next build && node -e \"import('@dignetwork/next-plugin-dig').then(m=>m.digDeploy())\""
 * }
 * ```
 *
 * Defaults `outputDir` to `out` (Next's export dir); an explicit `outputDir` (or `DIGSTORE_OUTPUT_DIR`
 * / `dig.toml`'s `output-dir`) overrides it. Reads `dig.toml` + env (`DIGSTORE_*`) for the rest;
 * secrets (deploy key / salt) come from env ONLY (never the argv). The adapter has already built, so
 * `digstore` stages the existing `out/` rather than rebuilding. On failure it throws a coded
 * {@link DigAdapterError} (branch on `.code`).
 *
 * @returns the parsed {@link DeployResult} (`capsule` = `storeId:rootHash`, `digUrl`, `hubUrl`).
 */
export async function digDeploy(
  options: DigDeployOptions = {},
  deps: DigDeployDeps = {},
): Promise<DeployResult> {
  const run = deps.runner ?? runDeploy;
  try {
    return await run({
      ...options,
      // Default to Next's export dir; an explicit outputDir (from options/env/dig.toml) wins.
      outputDir: options.outputDir ?? NEXT_EXPORT_DIR,
      // The adapter ran `next build` already — stage the existing out/, don't rebuild.
      skipBuild: true,
    });
  } catch (e) {
    throw toAdapterError(e);
  }
}

export default digDeploy;
