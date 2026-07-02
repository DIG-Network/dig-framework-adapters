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
  assert.equal(DIG_ADAPTER_ERROR_CODES.DEPLOY_FAILED, "DEPLOY_FAILED");
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

test("digDeploy: honors an already-coded error from the SDK runner (newer DigSdkError)", async () => {
  // Newer SDK versions throw an error already carrying a valid `.code`; the adapter must pass that
  // code through unchanged rather than re-classifying by message.
  const runner = async () => {
    const e = new Error("a non-hex store id was supplied");
    e.code = "INVALID_ARGUMENT";
    throw e;
  };
  await assert.rejects(digDeploy({}, { runner }), (e) => {
    assert.ok(isDigAdapterError(e, "INVALID_ARGUMENT"));
    return true;
  });
});

test("digDeploy: a coded DigAdapterError from the runner is rethrown unchanged", async () => {
  const coded = new DigAdapterError("DEPLOY_FAILED", "already coded", { exitCode: 2 });
  const runner = async () => {
    throw coded;
  };
  await assert.rejects(digDeploy({}, { runner }), (e) => {
    assert.equal(e, coded, "an existing DigAdapterError is rethrown as-is");
    return true;
  });
});

test("digDeploy: a non-Error throw is stringified into a DEPLOY_FAILED error", async () => {
  const runner = async () => {
    throw "plain string failure";
  };
  await assert.rejects(digDeploy({}, { runner }), (e) => {
    assert.ok(e instanceof DigAdapterError);
    assert.equal(e.code, "DEPLOY_FAILED");
    assert.equal(e.message, "plain string failure");
    return true;
  });
});

test("isDigAdapterError: false for non-adapter errors and mismatched codes", () => {
  assert.equal(isDigAdapterError(new Error("nope")), false);
  const err = new DigAdapterError("DEPLOY_FAILED", "boom");
  assert.equal(isDigAdapterError(err, "DIGSTORE_NOT_FOUND"), false);
  assert.equal(isDigAdapterError(err, "DEPLOY_FAILED"), true);
});

test("DigAdapterError: toJSON() exposes code/message/context for machines", () => {
  const err = new DigAdapterError("DEPLOY_FAILED", "boom", { exitCode: 7 });
  assert.deepEqual(err.toJSON(), {
    code: "DEPLOY_FAILED",
    message: "boom",
    context: { exitCode: 7 },
  });
});
