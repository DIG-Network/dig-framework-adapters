// Next has no Vite-style transformIndexHtml hook, so the dev-shim is surfaced as helpers the app
// wires into its <head> (e.g. in app/layout.tsx, gated on NODE_ENV !== "production"):
//   • digNextDevShimScript() — the raw eval-free script BODY (no <script> tags), for Next's
//     <Script dangerouslySetInnerHTML> or a custom _document.
//   • digNextDevShimTag()    — a ready-to-inline `<script>…</script>` string.
// Both install the SAME injected-provider contract the SDK's ChiaProvider detects in production.

import test from "node:test";
import assert from "node:assert/strict";
import { digNextDevShimScript, digNextDevShimTag } from "../dist/index.js";
import { DEV_SHIM_MARKER } from "@dignetwork/dig-sdk/adapters";

test("digNextDevShimScript: returns the eval-free shim body defining window.chia", () => {
  const s = digNextDevShimScript();
  assert.match(s, /window\.chia/);
  assert.match(s, /isDIG/);
  assert.ok(s.includes(DEV_SHIM_MARKER), "must carry the dev-shim marker");
  assert.ok(!/\beval\s*\(/.test(s), "no eval()");
  assert.ok(!/new\s+Function\s*\(/.test(s), "no new Function()");
  // It is a script BODY — no surrounding <script> tags.
  assert.ok(!s.includes("<script"), "the script() helper returns the body only, no <script> tag");
});

test("digNextDevShimScript: forwards a configured mock dev address", () => {
  const addr = "xch1nextmockaddr";
  const s = digNextDevShimScript({ address: addr });
  assert.ok(s.includes(addr), "the configured dev address must appear in the shim");
});

test("digNextDevShimTag: wraps the shim body in a <script> tag", () => {
  const tag = digNextDevShimTag();
  assert.match(tag, /^<script>/, "must start with <script>");
  assert.match(tag, /<\/script>$/, "must end with </script>");
  assert.ok(tag.includes(DEV_SHIM_MARKER), "must contain the shim");
});
