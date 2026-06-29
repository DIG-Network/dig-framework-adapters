// The Vite plugin object — its shape and the dev-shim injection it performs at the
// `transformIndexHtml` boundary. We don't run a real Vite build; we drive the plugin's hook
// directly (the same call Vite makes), which is the framework boundary the task says to mock.
//
// What the plugin must do during `vite dev`:
//   • be a structurally-valid Vite plugin (name + transformIndexHtml),
//   • only apply on the dev server (apply: "serve") — the shim is meaningless for a build,
//   • inject the SDK's eval-free `window.chia` dev shim into the served HTML <head>,
//   • be opt-out-able (devWallet: false) and accept a configured mock address.

import test from "node:test";
import assert from "node:assert/strict";
import { digVite } from "../dist/index.js";
import { DEV_SHIM_MARKER } from "@dignetwork/dig-sdk/adapters";

// Drive the transformIndexHtml hook the way Vite does (it accepts a function OR an
// { order, handler } object). This helper normalizes both so the test is hook-shape agnostic.
function runTransform(plugin, html) {
  const t = plugin.transformIndexHtml;
  if (typeof t === "function") return t(html);
  return t.handler(html);
}

test("digVite: returns a structurally-valid Vite plugin", () => {
  const p = digVite();
  assert.equal(typeof p, "object");
  assert.equal(p.name, "dignetwork:vite-plugin-dig");
  assert.ok(p.transformIndexHtml, "must expose a transformIndexHtml hook");
});

test("digVite: applies only to the dev server (serve), not the build", () => {
  const p = digVite();
  assert.equal(p.apply, "serve");
});

test("digVite: injects the eval-free window.chia dev shim into <head>", () => {
  const p = digVite();
  const out = runTransform(p, "<html><head></head><body></body></html>");
  assert.match(out, /<script>/, "must inject a <script> tag");
  assert.match(out, /window\.chia/, "shim must define window.chia");
  assert.ok(out.includes(DEV_SHIM_MARKER), "shim must carry the dev-shim marker");
  // The shim goes inside <head> so window.chia exists before app code runs.
  const headIdx = out.indexOf("<head>");
  const shimIdx = out.indexOf(DEV_SHIM_MARKER);
  assert.ok(headIdx >= 0 && shimIdx > headIdx, "shim must be injected after <head>");
});

test("digVite: the injected shim is eval-free (CSP-safe)", () => {
  const p = digVite();
  const out = runTransform(p, "<head></head>");
  assert.ok(!/\beval\s*\(/.test(out), "no eval()");
  assert.ok(!/new\s+Function\s*\(/.test(out), "no new Function()");
});

test("digVite: devWallet:false disables shim injection (HTML passes through)", () => {
  const p = digVite({ devWallet: false });
  const html = "<head></head><body>app</body>";
  const out = runTransform(p, html);
  assert.equal(out, html, "with devWallet:false the HTML must be returned unchanged");
});

test("digVite: forwards a configured mock dev address into the shim", () => {
  const addr = "xch1custommockaddr";
  const p = digVite({ devWalletOptions: { address: addr } });
  const out = runTransform(p, "<head></head>");
  assert.ok(out.includes(addr), "the configured dev address must appear in the injected shim");
});

test("digVite: handles HTML with no <head> by prepending the shim", () => {
  const p = digVite();
  const out = runTransform(p, "<body>no head here</body>");
  assert.ok(out.includes(DEV_SHIM_MARKER), "shim must still be injected when there is no <head>");
});
