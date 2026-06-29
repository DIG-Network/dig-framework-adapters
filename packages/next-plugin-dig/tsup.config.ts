import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";

// The published version, read from package.json and injected as a compile-time constant so
// `version()` / `capabilities().version` can never drift from what's on npm (see src/capabilities.ts).
const pkgVersion = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"))
  .version as string;

// Build the adapter to ESM + CJS + .d.ts.
//
//  • Single entrypoint (`index`). The adapter composes the proven, separately-published
//    `@dignetwork/dig-sdk/adapters` core (dig.toml reader, config resolution, the eval-free dev-shim
//    generator, and the `digstore deploy` runner) for Next static export.
//  • `@dignetwork/dig-sdk` is an EXTERNAL dependency — never bundled.
//  • `next` is an OPTIONAL peer; this adapter imports nothing from "next" (Next has no
//    transformIndexHtml hook, so dev-shim injection is surfaced as helpers the app wires in).
export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  external: ["@dignetwork/dig-sdk", "next"],
  define: {
    __PLUGIN_VERSION__: JSON.stringify(pkgVersion),
  },
  esbuildOptions(options) {
    // No eval anywhere — keep the bundle CSP-safe.
    options.legalComments = "none";
  },
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});
