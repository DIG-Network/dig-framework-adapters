// @dignetwork/dig-adapters-shared — the single source of truth for the two contracts that must stay
// byte-identical across @dignetwork/vite-plugin-dig and @dignetwork/next-plugin-dig: the typed error
// taxonomy (DIG_ADAPTER_ERROR_CODES) and the deploy-result chia:// normalization. See errors.ts /
// deploy-result.ts for the WHY behind each.

export {
  DIG_ADAPTER_ERROR_CODES,
  DigAdapterError,
  isDigAdapterError,
  toAdapterError,
  type DigAdapterErrorCode,
  type DigAdapterErrorContext,
} from "./errors.js";

export { normalizeDeployResult, type DeployResult } from "./deploy-result.js";
