// @dignetwork/vite-plugin-dig — make DIG a first-class deploy target for Vite.
//
// Two jobs:
//   1. DEV: during `vite dev` it injects the SDK's eval-free `window.chia` dev shim into the served
//      HTML, so a plain browser (no DIG Browser, no extension) still has an injected wallet to
//      develop against — the SAME injected-provider contract the `@dignetwork/dig-sdk` ChiaProvider
//      detects in production. The shim guards on a real `window.chia`, so the DIG Browser / a real
//      extension always wins, and it refuses to fake a signature (a dev stub must never mislead).
//   2. PUBLISH: it exposes `digDeploy()` — call it from a `publish` script (after `vite build`) to
//      ship the build output to a DIG capsule via `digstore deploy --json`, printing the chia:// /
//      DIGHub URL. Deploy is a deliberate, credentialed step (it spends $DIG), so it is NOT wired
//      into the default `vite build`; you opt in via a `publish` script.
//
// The plugin is intentionally thin: it composes the proven, separately-published
// `@dignetwork/dig-sdk/adapters` core (the dig.toml reader, options>env>dig.toml>default config
// resolution, the eval-free dev-shim generator, and the `digstore deploy` runner). All deploy logic
// — advancing the on-chain root, staging, pushing the capsule — lives in `digstore deploy`, the
// canonical deployer; this never hand-rolls a deploy or a spend. (SYSTEM.md → "Don't hand-roll
// spends"; the URLs/config mirror `digstore` exactly so the plugin can never disagree with the CLI.)
//
// `vite` is an OPTIONAL peer dependency: this module declares no runtime import of "vite". The
// returned object is a structurally-valid Vite `Plugin`, typed against vite's own types where
// available and falling back to a structural shape so the package builds without vite installed.

import {
  devShimScript,
  runDeploy,
  type DevShimOptions,
  type RunDeployOptions,
  type DeployResult,
} from "@dignetwork/dig-sdk/adapters";
import { toAdapterError } from "./errors.js";

export { version, capabilities, describe, type PluginCapabilities } from "./capabilities.js";
export {
  DigAdapterError,
  isDigAdapterError,
  DIG_ADAPTER_ERROR_CODES,
  type DigAdapterErrorCode,
  type DigAdapterErrorContext,
} from "./errors.js";
// Re-export the deploy result + dev-shim option types so consumers get the full typed surface.
export type { DevShimOptions, DeployResult } from "@dignetwork/dig-sdk/adapters";

/** Options for {@link digVite}. */
export interface DigVitePluginOptions {
  /**
   * Inject the dev `window.chia` shim during `vite dev`. Default: `true`. The shim never clobbers a
   * real injected wallet (it guards on an existing `window.chia`).
   */
  devWallet?: boolean;
  /** Dev-shim options (e.g. the mock address it returns from `getAddress`). */
  devWalletOptions?: DevShimOptions;
}

// A minimal structural type for the slice of the Vite Plugin shape we return, so the package does
// not hard-depend on "vite". A real Vite `Plugin` is assignable to this.
interface VitePluginLike {
  name: string;
  apply?: "serve" | "build";
  transformIndexHtml?: {
    order: "pre";
    handler: (html: string) => string;
  };
}

/**
 * The Vite plugin. Add to `vite.config` `plugins: [digVite()]`. Injects the dev wallet shim during
 * `vite dev`; deploys are run separately via {@link digDeploy} from a `publish` script (deploy spends
 * $DIG, so it is never part of the default build).
 *
 * @example
 * // vite.config.ts
 * import { digVite } from "@dignetwork/vite-plugin-dig";
 * export default { plugins: [digVite()] };
 */
export function digVite(options: DigVitePluginOptions = {}): VitePluginLike {
  const injectDev = options.devWallet !== false;
  const shim = injectDev ? devShimScript(options.devWalletOptions) : "";

  return {
    name: "dignetwork:vite-plugin-dig",
    // The dev shim is only meaningful for the dev server — never injected into a production build.
    apply: "serve",
    transformIndexHtml: {
      order: "pre",
      handler(html: string): string {
        if (!injectDev) return html;
        const tag = `\n<script>${shim}</script>\n`;
        // Inject as early as possible so window.chia exists before app code runs.
        if (html.includes("<head>")) return html.replace("<head>", `<head>${tag}`);
        return tag + html;
      },
    },
  };
}

/** Options for {@link digDeploy} — all {@link RunDeployOptions} plus an injectable runner seam. */
export interface DigDeployOptions extends RunDeployOptions {}

/** Test/extension seam: the function {@link digDeploy} delegates the actual deploy to. */
export interface DigDeployDeps {
  /** Override the deploy runner (defaults to the SDK's `runDeploy`). Used to test the wiring. */
  runner?: (opts: RunDeployOptions) => Promise<DeployResult>;
}

/**
 * Deploy the built site to a DIG capsule. Call from a `publish` npm script AFTER `vite build`:
 *
 * ```jsonc
 * // package.json
 * "scripts": {
 *   "deploy": "vite build && node -e \"import('@dignetwork/vite-plugin-dig').then(m=>m.digDeploy())\""
 * }
 * ```
 *
 * Reads `dig.toml` + env (`DIGSTORE_*`) for config + secrets (the deploy key / salt come from env
 * ONLY, never the argv, so they can't leak into the process table or a config file). The adapter has
 * already built, so it tells `digstore` to stage the existing output dir rather than rebuild. On
 * failure it throws a coded {@link DigAdapterError} (branch on `.code`).
 *
 * @returns the parsed {@link DeployResult} (`capsule` = `storeId:rootHash`, `digUrl`, `hubUrl`).
 */
export async function digDeploy(
  options: DigDeployOptions = {},
  deps: DigDeployDeps = {},
): Promise<DeployResult> {
  const run = deps.runner ?? runDeploy;
  try {
    // The adapter ran `vite build` already — stage the existing output dir, don't rebuild.
    return await run({ ...options, skipBuild: true });
  } catch (e) {
    throw toAdapterError(e);
  }
}

export default digVite;
