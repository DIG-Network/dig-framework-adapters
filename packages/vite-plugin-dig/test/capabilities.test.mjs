// Agent-friendly self-description — `version()` and `capabilities()` let an agent (or a CI step)
// introspect what the plugin is and does without reading source. The version is injected at build
// time from package.json so it can never drift from what's on npm.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { version, capabilities } from "../dist/index.js";

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

test("version(): matches package.json (build-time injected, never drifts)", () => {
  assert.equal(version(), pkg.version);
});

test("capabilities(): describes the plugin surface for agents", () => {
  const cap = capabilities();
  assert.equal(cap.name, "@dignetwork/vite-plugin-dig");
  assert.equal(cap.version, pkg.version);
  assert.equal(cap.framework, "vite");
  // The two capabilities the plugin advertises.
  assert.ok(Array.isArray(cap.features));
  assert.ok(cap.features.includes("dev-wallet-shim"), "advertises the dev window.chia shim");
  assert.ok(cap.features.includes("publish-deploy"), "advertises the digstore deploy publish step");
  // The stable error-code catalogue (re-exported from the SDK) is discoverable here.
  assert.ok(Array.isArray(cap.errorCodes) && cap.errorCodes.length > 0);
  assert.ok(cap.errorCodes.includes("DEPLOY_FAILED"));
  assert.ok(cap.errorCodes.includes("DIGSTORE_NOT_FOUND"));
});

test("capabilities(): docs link uses the canonical docs.dig.net/docs path", () => {
  const cap = capabilities();
  assert.match(cap.docs, /^https:\/\/docs\.dig\.net\/docs\//);
});
