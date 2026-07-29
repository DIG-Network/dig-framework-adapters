// Locks the two adapters to the SAME machine-readable error-code contract.
//
// vite-plugin-dig and next-plugin-dig both throw a coded `DigAdapterError` from
// `@dignetwork/dig-adapters-shared` (see errors.ts there for the WHY). Since #1811 that shared
// package is the SINGLE source for `DIG_ADAPTER_ERROR_CODES`, so the two published bundles can no
// longer drift apart — this test asserts that directly against each package's own BUILT dist (the
// artifact npm actually ships), so a future regression (e.g. a package accidentally pinning its own
// copy again) fails loudly here rather than silently shipping mismatched codes.

import test from "node:test";
import assert from "node:assert/strict";
import { DIG_ADAPTER_ERROR_CODES as viteErrorCodes } from "../dist/index.js";
import { DIG_ADAPTER_ERROR_CODES as nextErrorCodes } from "../../next-plugin-dig/dist/index.js";

test("DIG_ADAPTER_ERROR_CODES: vite-plugin-dig and next-plugin-dig agree byte-for-byte", () => {
  assert.deepEqual(viteErrorCodes, nextErrorCodes);
});
