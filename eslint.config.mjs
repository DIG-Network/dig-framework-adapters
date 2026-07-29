// Flat-config ESLint for the dig-framework-adapters monorepo (CLAUDE.md §2.4a).
// `npm run lint` is a CI gate that MUST pass with ZERO errors. Formatting concerns are deferred to
// Prettier via eslint-config-prettier (kept LAST below), so the two gates never fight over style.
//
// Two linting surfaces, each with its own globals:
//   - packages/*/src/**/*.ts   the TypeScript plugin source (Vite + Next adapters)
//   - packages/*/test/**/*.mjs the node:test unit suites (plain ESM, not typechecked TS)
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    // Generated output, coverage reports, and installed deps are never linted.
    ignores: ["**/dist/**", "**/coverage/**", "node_modules/**"],
  },
  {
    // The TypeScript library source — the published plugin surface.
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["packages/*/src/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // The node:test unit suites — plain ESM with Node globals, not part of the TS build.
    extends: [js.configs.recommended],
    files: ["packages/*/test/**/*.mjs", "*.config.{js,mjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
  },
  // Defer all stylistic rules to Prettier — MUST stay last so it wins over any stylistic rule above.
  prettier,
);
