// Agent-friendly self-description — `version()` and `capabilities()` let an agent introspect the
// adapter without reading source. The version is injected at build time from package.json.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { version, capabilities } from "../dist/index.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("version(): matches package.json (build-time injected, never drifts)", () => {
  assert.equal(version(), pkg.version);
});

test("capabilities(): describes the adapter surface for agents", () => {
  const cap = capabilities();
  assert.equal(cap.name, "@dignetwork/next-plugin-dig");
  assert.equal(cap.version, pkg.version);
  assert.equal(cap.framework, "next");
  assert.ok(Array.isArray(cap.features));
  assert.ok(cap.features.includes("dev-wallet-shim"));
  assert.ok(cap.features.includes("publish-deploy"));
  assert.ok(Array.isArray(cap.errorCodes) && cap.errorCodes.includes("DEPLOY_FAILED"));
  // The adapter advertises the Next static-export dir it ships.
  assert.equal(cap.exportDir, "out");
});

test("capabilities(): docs link uses the canonical docs.dig.net/docs path", () => {
  const cap = capabilities();
  assert.match(cap.docs, /^https:\/\/docs\.dig\.net\/docs\//);
});
