// The adapter's stable error taxonomy — the publish path always surfaces a coded `DigAdapterError`
// (the underlying SDK runner throws plain Errors in published versions; this layer maps them onto a
// stable `.code` an agent can branch on). We drive `digDeploy` with a runner that throws.

import test from "node:test";
import assert from "node:assert/strict";
import {
  digDeploy,
  DigAdapterError,
  isDigAdapterError,
  DIG_ADAPTER_ERROR_CODES,
} from "../dist/index.js";

test("DIG_ADAPTER_ERROR_CODES: catalogue is frozen and self-keyed", () => {
  assert.ok(Object.isFrozen(DIG_ADAPTER_ERROR_CODES));
  for (const [k, v] of Object.entries(DIG_ADAPTER_ERROR_CODES)) assert.equal(k, v);
});

test("digDeploy: a 'digstore not installed' failure maps to DIGSTORE_NOT_FOUND", async () => {
  const runner = async () => {
    throw new Error('could not run "digstore" — is digstore installed and on PATH? (ENOENT)');
  };
  await assert.rejects(digDeploy({}, { runner }), (e) => {
    assert.ok(isDigAdapterError(e, "DIGSTORE_NOT_FOUND"));
    return true;
  });
});

test("digDeploy: a non-zero exit maps to DEPLOY_FAILED and preserves the cause", async () => {
  const original = new Error("digstore deploy failed (exit 7).");
  const runner = async () => {
    throw original;
  };
  await assert.rejects(digDeploy({}, { runner }), (e) => {
    assert.ok(e instanceof DigAdapterError);
    assert.equal(e.code, "DEPLOY_FAILED");
    assert.equal(e.cause, original);
    return true;
  });
});

test("digDeploy: unparseable output maps to DEPLOY_OUTPUT_UNPARSEABLE", async () => {
  const runner = async () => {
    throw new Error("digstore deploy did not report a capsule (deploy may have failed).");
  };
  await assert.rejects(digDeploy({}, { runner }), (e) => {
    assert.equal(e.code, "DEPLOY_OUTPUT_UNPARSEABLE");
    return true;
  });
});
