// The publish hand-off — `digDeploy()` ships the Next STATIC EXPORT to a DIG capsule.
//
// Next static export (`next build` with `output: "export"`) writes to `out/`. The adapter defaults
// `outputDir` to `out` (vs the SDK's generic `dist`), then shells out to `digstore deploy --json`
// (the canonical deployer) to stage that dir → a new capsule. We inject a fake runner at the spawn
// boundary so the test asserts the WIRING — the `out` default, skipBuild, and the parsed capsule —
// without spending $DIG or needing digstore installed.

import test from "node:test";
import assert from "node:assert/strict";
import { digDeploy } from "../dist/index.js";

const STORE = "ab".repeat(32);
const ROOT = "cd".repeat(32);
const CHIA_URL = `chia://${STORE}:${ROOT}/`;

// Simulate the CURRENTLY-PUBLISHED SDK runner (still a dig:// digUrl, no chiaUrl); the adapter must
// normalize the user-facing open URL to the canonical chia://<store>:<root>/ on the way out.
function fakeResult() {
  return {
    capsule: `${STORE}:${ROOT}`,
    storeId: STORE,
    root: ROOT,
    digUrl: `dig://${STORE}`,
    hubUrl: `https://hub.dig.net/stores/${STORE}`,
    pushed: true,
  };
}

test("digDeploy: defaults outputDir to Next's export dir (out) and stages without rebuilding", async () => {
  let received;
  const fakeRunner = async (opts) => {
    received = opts;
    return fakeResult();
  };

  const result = await digDeploy({ message: "from next" }, { runner: fakeRunner });

  assert.equal(received.outputDir, "out", "Next static export writes to out/ by default");
  assert.equal(received.skipBuild, true, "the adapter built — digstore stages, not rebuilds");
  assert.equal(received.message, "from next");
  assert.equal(result.capsule, `${STORE}:${ROOT}`);
  // The user-facing content-open URL is chia://<store>:<root>/ (SYSTEM.md canon), surfaced as chiaUrl;
  // digUrl is a deprecated alias carrying the SAME chia:// value.
  assert.equal(result.chiaUrl, CHIA_URL, "chiaUrl is the canonical chia:// content-open address");
  assert.equal(result.digUrl, CHIA_URL, "digUrl is a back-compat alias of the chia:// value");
});

test("digDeploy: prefers a chiaUrl the SDK already provides (forward-compat with the new SDK)", async () => {
  // The new SDK already returns chiaUrl=chia://…/ and digUrl aliased to it; the adapter must pass that
  // through unchanged (normalization is idempotent), not re-derive a different value.
  const fakeRunner = async () => ({
    capsule: `${STORE}:${ROOT}`,
    storeId: STORE,
    root: ROOT,
    chiaUrl: CHIA_URL,
    digUrl: CHIA_URL,
    hubUrl: `https://hub.dig.net/stores/${STORE}`,
    pushed: true,
  });

  const result = await digDeploy({}, { runner: fakeRunner });
  assert.equal(result.chiaUrl, CHIA_URL, "an SDK-supplied chiaUrl passes through unchanged");
  assert.equal(result.digUrl, CHIA_URL, "digUrl stays the same chia:// alias");
});

test("digDeploy: an explicit outputDir overrides the out default", async () => {
  let received;
  const fakeRunner = async (opts) => {
    received = opts;
    return fakeResult();
  };

  await digDeploy({ outputDir: "dist" }, { runner: fakeRunner });
  assert.equal(received.outputDir, "dist", "an explicit outputDir must win over the out default");
});

test("digDeploy: forwards cwd / digstoreBin / storeId through to the runner", async () => {
  let received;
  const fakeRunner = async (opts) => {
    received = opts;
    return fakeResult();
  };

  await digDeploy(
    { storeId: STORE, cwd: "/proj", digstoreBin: "/usr/bin/digstore" },
    { runner: fakeRunner },
  );

  assert.equal(received.storeId, STORE);
  assert.equal(received.cwd, "/proj");
  assert.equal(received.digstoreBin, "/usr/bin/digstore");
});
