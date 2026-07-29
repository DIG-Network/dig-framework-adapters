import { defineConfig } from "tsup";

// Build the shared errors/deploy-result contract to ESM + CJS + .d.ts.
//
// This package is PRIVATE (never published) — the two adapters consume it as a workspace
// dependency and each adapter's own tsup build inlines it (`noExternal`) into its published dist, so
// a consumer of vite-plugin-dig / next-plugin-dig never sees or installs this package. Building it
// to a real ESM+CJS+d.ts pair (rather than leaving it as raw TS) keeps both adapters' builds fast and
// keeps the shared `.d.ts` a single source of truth for the re-exported public types.
//
// `@dignetwork/dig-sdk` is EXTERNAL here too (deploy-result.ts only imports its `DeployResult`
// TYPE, erased at build) — mirrors both adapters' tsup config.
export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  external: ["@dignetwork/dig-sdk"],
  esbuildOptions(options) {
    options.legalComments = "none";
  },
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});
