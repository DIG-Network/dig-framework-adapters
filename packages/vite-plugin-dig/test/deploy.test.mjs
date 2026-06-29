// The publish hand-off — `digDeploy()` ships the BUILT output to a DIG capsule.
//
// The plugin never re-implements deploy: `digstore deploy` is the canonical deployer (advances the
// on-chain root, stages the build dir, pushes the capsule to DIGHub). `digDeploy()` marshals
// options/dig.toml/env into that call and parses the capsule result. We inject a fake runner at the
// boundary (the seam where it would spawn `digstore`) so the test asserts the WIRING — that the
// adapter already built (skipBuild) and returns the parsed capsule — without spending DIG or needing
// digstore installed.

import test from "node:test";
import assert from "node:assert/strict";
import { digDeploy } from "../dist/index.js";

const STORE = "ab".repeat(32);
const ROOT = "cd".repeat(32);

test("digDeploy: invokes the runner with skipBuild (the build already ran) and returns the capsule", async () => {
  let received;
  const fakeRunner = async (opts) => {
    received = opts;
    return {
      capsule: `${STORE}:${ROOT}`,
      storeId: STORE,
      root: ROOT,
      digUrl: `dig://${STORE}`,
      hubUrl: `https://hub.dig.net/stores/${STORE}`,
      pushed: true,
    };
  };

  const result = await digDeploy({ message: "from vite" }, { runner: fakeRunner });

  assert.equal(received.skipBuild, true, "the adapter built — digstore must stage, not rebuild");
  assert.equal(received.message, "from vite", "options must be forwarded to the runner");
  assert.equal(result.capsule, `${STORE}:${ROOT}`);
  assert.equal(result.digUrl, `dig://${STORE}`);
  assert.equal(result.hubUrl, `https://hub.dig.net/stores/${STORE}`);
  assert.equal(result.pushed, true);
});

test("digDeploy: forwards cwd / digstoreBin / storeId / outputDir through to the runner", async () => {
  let received;
  const fakeRunner = async (opts) => {
    received = opts;
    return { capsule: `${STORE}:${ROOT}`, storeId: STORE, root: ROOT, digUrl: "", hubUrl: "" };
  };

  await digDeploy(
    { storeId: STORE, outputDir: "build", cwd: "/proj", digstoreBin: "/usr/bin/digstore" },
    { runner: fakeRunner },
  );

  assert.equal(received.storeId, STORE);
  assert.equal(received.outputDir, "build");
  assert.equal(received.cwd, "/proj");
  assert.equal(received.digstoreBin, "/usr/bin/digstore");
});
