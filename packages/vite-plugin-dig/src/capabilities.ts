// Runtime self-description — the plugin's introspection surface, so an agent can discover its
// version, framework, features, error codes, and docs WITHOUT reading source (AGENT_FRIENDLY.md →
// "Self-describing"). The version is replaced at build time by tsup's `define` (see tsup.config.ts)
// with package.json's value, so it can never drift from what's on npm.

import { DIG_ADAPTER_ERROR_CODES, type DigAdapterErrorCode } from "./errors.js";

// Injected by tsup `define` ({ __PLUGIN_VERSION__: JSON.stringify(pkg.version) }). The `declare`
// keeps TypeScript happy; the fallback covers unbundled / test execution.
declare const __PLUGIN_VERSION__: string | undefined;

/** The plugin's semver version, from package.json (injected at build time). */
const PLUGIN_VERSION: string =
  typeof __PLUGIN_VERSION__ === "string" ? __PLUGIN_VERSION__ : "0.0.0-dev";

/** The plugin's semver version. */
export function version(): string {
  return PLUGIN_VERSION;
}

/** The machine-readable description of the plugin — what {@link capabilities} returns. */
export interface PluginCapabilities {
  /** Always `"@dignetwork/vite-plugin-dig"`. */
  readonly name: string;
  /** The plugin semver (= {@link version}). */
  readonly version: string;
  /** The framework this adapter targets. */
  readonly framework: "vite";
  /** The capabilities the plugin advertises. */
  readonly features: readonly ("dev-wallet-shim" | "publish-deploy")[];
  /** The stable error-code catalogue (UPPER_SNAKE) the publish path can throw. */
  readonly errorCodes: readonly DigAdapterErrorCode[];
  /** The canonical docs entry point. */
  readonly docs: string;
}

/**
 * Describe the plugin's surface as machine-readable data: version, framework, features, error codes,
 * and the docs link. An agent can call this to introspect the plugin without reading source.
 *
 * @example
 * import { capabilities } from "@dignetwork/vite-plugin-dig";
 * capabilities().features;    // ["dev-wallet-shim", "publish-deploy"]
 * capabilities().errorCodes;  // ["DIGSTORE_NOT_FOUND", "DEPLOY_FAILED", …]
 */
export function capabilities(): PluginCapabilities {
  return {
    name: "@dignetwork/vite-plugin-dig",
    version: PLUGIN_VERSION,
    framework: "vite",
    features: ["dev-wallet-shim", "publish-deploy"],
    errorCodes: Object.values(DIG_ADAPTER_ERROR_CODES),
    // The canonical app-developer landing on docs.dig.net (the audience this adapter serves: build,
    // preview, and deploy a frontend to a capsule). Verified to resolve against the live docs routes.
    docs: "https://docs.dig.net/docs/audiences/app-developers",
  };
}

/** Alias for {@link capabilities} — the conventional `describe()` introspection name. */
export const describe = capabilities;
