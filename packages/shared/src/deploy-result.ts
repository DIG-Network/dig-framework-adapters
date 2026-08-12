// Normalize the SDK's parsed deploy result to the canonical user-facing content-open contract.
//
// WHY this lives here: the user-facing "open this capsule" address is `chia://` (SYSTEM.md →
// "Canonical terminology & branding" — the scheme the DIG Browser / extension register). The SDK's
// `parseDeployResult` already emits `chiaUrl` (with `digUrl` kept as a deprecated alias of the SAME
// chia:// value). We still normalize the runner's result on the way out so the adapter's guarantee —
// it NEVER returns a `dig://` open URL, and its prose ("prints the chia:// URL") is always backed by
// a real field — holds on the adapter's OWN surface rather than depending on the SDK upholding it.
// The normalization is idempotent: a result the SDK already normalized passes through unchanged.
//
// (Exempt — NOT touched here: the §21 remote-transport locator `dig://<host>/<store_id>` and the
// `urn:dig:` namespace, which legitimately stay `dig://`.)

import type { DeployResult as SdkDeployResult } from "@dignetwork/dig-sdk/adapters";

/**
 * The adapter's deploy result. Extends the SDK's shape with the canonical {@link chiaUrl}
 * content-open field (the SDK emits it too; declared here so the field is part of the adapter's own
 * published contract, independent of the SDK's).
 */
export interface DeployResult extends SdkDeployResult {
  /**
   * The user-facing content-open address `chia://<storeId>:<rootHash>/` — what a user types/clicks
   * to open this verified capsule in the DIG Browser / extension. Matches `digstore deploy`'s printed
   * `content_address`. (Distinct from the §21 remote locator `dig://<host>/<store_id>` and the
   * `urn:dig:` namespace, which stay `dig://`.)
   */
  chiaUrl: string;
}

/**
 * Derive the canonical `chia://<storeId>:<rootHash>/` content-open URL and return a result whose
 * `chiaUrl` carries it and whose (deprecated) `digUrl` is an alias of the SAME chia:// value. Prefers
 * a `chiaUrl` the SDK already supplied so the adapter stays byte-identical to the CLI/SDK.
 */
export function normalizeDeployResult(result: SdkDeployResult): DeployResult {
  const existing = (result as Partial<DeployResult>).chiaUrl;
  const chiaUrl =
    typeof existing === "string" && existing.length > 0
      ? existing
      : `chia://${result.storeId}:${result.root}/`;
  return {
    ...result,
    chiaUrl,
    // Deprecated alias: the SAME chia:// content-open value (never a dig:// URL).
    digUrl: chiaUrl,
  };
}
