import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";

// The published version, read from package.json and injected as a compile-time constant so
// `version()` / `capabilities().version` can never drift from what's on npm (see src/capabilities.ts).
// Mirrors the dig-sdk tsup pattern.
const pkgVersion = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"))
  .version as string;

// Build the plugin to ESM + CJS + .d.ts.
//
//  • Single entrypoint (`index`). The plugin is small — it composes the proven, separately-published
//    `@dignetwork/dig-sdk/adapters` core (dig.toml reader, config resolution, the eval-free dev-shim
//    generator, and the `digstore deploy` runner) into a Vite Plugin object.
//  • `@dignetwork/dig-sdk` is an EXTERNAL dependency — never bundled or re-emitted; consumers get it
//    transitively and the two stay version-aligned.
//  • `vite` is an OPTIONAL peer; we import only its TYPES (erased at build), never its runtime, so the
//    plugin builds + loads without vite installed.
export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  external: ["@dignetwork/dig-sdk", "vite"],
  // Inject the package version as the compile-time constant `__PLUGIN_VERSION__` (read by
  // src/capabilities.ts) so the published `version()` always matches package.json.
  define: {
    __PLUGIN_VERSION__: JSON.stringify(pkgVersion),
  },
  esbuildOptions(options) {
    // No eval anywhere — keep the bundle CSP-safe (no `unsafe-eval` required).
    options.legalComments = "none";
  },
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});
