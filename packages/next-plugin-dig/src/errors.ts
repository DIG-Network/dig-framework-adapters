// The plugin's typed error taxonomy — the machine-readable failure contract at the publish boundary.
//
// Every failure `digDeploy()` surfaces is a `DigAdapterError` (an `Error` subclass) carrying a
// STABLE, documented `.code` (UPPER_SNAKE) plus structured context. An agent (or a CI step) branches
// on `err.code` instead of string-matching the human `.message`, and the catalogue is discoverable
// from the `.d.ts` via the exported `DIG_ADAPTER_ERROR_CODES` const and the `DigAdapterErrorCode`
// union. (We catalogue the codes HERE rather than re-export the SDK's, because the underlying
// `@dignetwork/dig-sdk` deploy runner throws plain `Error`s in published versions — this plugin is
// the layer that gives the publish step a stable code an agent can act on. See AGENT_FRIENDLY.md →
// "Structured errors with a stable machine code".)

/**
 * The stable error-code catalogue for the publish path. Each value is an UPPER_SNAKE symbolic string
 * callers may branch on. Frozen so it can't be mutated at runtime; the README documents each meaning.
 */
export const DIG_ADAPTER_ERROR_CODES = Object.freeze({
  /** The `digstore` binary could not be spawned (not installed / not on PATH). */
  DIGSTORE_NOT_FOUND: "DIGSTORE_NOT_FOUND",
  /** `digstore deploy` exited non-zero (the on-chain root advance / push failed). */
  DEPLOY_FAILED: "DEPLOY_FAILED",
  /** `digstore deploy --json` output could not be parsed into a capsule result. */
  DEPLOY_OUTPUT_UNPARSEABLE: "DEPLOY_OUTPUT_UNPARSEABLE",
  /** An argument was malformed (e.g. a non-hex store id, mutually-exclusive options). */
  INVALID_ARGUMENT: "INVALID_ARGUMENT",
} as const);

/** The union of every stable adapter error code. Branch on `err.code` against these. */
export type DigAdapterErrorCode =
  (typeof DIG_ADAPTER_ERROR_CODES)[keyof typeof DIG_ADAPTER_ERROR_CODES];

/** Structured, code-specific context attached to a {@link DigAdapterError}. All fields optional. */
export interface DigAdapterErrorContext {
  /** The `digstore` binary name/path involved (DIGSTORE_NOT_FOUND). */
  bin?: string;
  /** The `digstore` process exit code (DEPLOY_FAILED). */
  exitCode?: number | null;
  /** The offending value (INVALID_ARGUMENT). */
  value?: string;
  /** Any further structured detail; kept open so codes can carry extra fields. */
  [key: string]: unknown;
}

/**
 * The plugin's typed error. Thrown by the publish path so consumers can branch on `.code`.
 *
 * @example
 * try {
 *   await digDeploy();
 * } catch (e) {
 *   if (e instanceof DigAdapterError && e.code === "DIGSTORE_NOT_FOUND") installDigstore();
 *   else throw e;
 * }
 */
export class DigAdapterError extends Error {
  /** The stable machine code (UPPER_SNAKE). Branch on this, not the message. */
  readonly code: DigAdapterErrorCode;
  /** Structured, code-specific context. */
  readonly context: DigAdapterErrorContext;

  constructor(
    code: DigAdapterErrorCode,
    message: string,
    context: DigAdapterErrorContext = {},
    options: { cause?: unknown } = {},
  ) {
    super(message);
    this.name = "DigAdapterError";
    this.code = code;
    this.context = context;
    // Set `cause` directly so the lib target stays ES2020 while preserving the underlying error.
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
    Object.setPrototypeOf(this, DigAdapterError.prototype);
  }

  /** A JSON-friendly view of the error: `{ code, message, context }`. */
  toJSON(): { code: DigAdapterErrorCode; message: string; context: DigAdapterErrorContext } {
    return { code: this.code, message: this.message, context: this.context };
  }
}

/** True iff `e` is a {@link DigAdapterError} (optionally with a specific `code`). */
export function isDigAdapterError(e: unknown, code?: DigAdapterErrorCode): e is DigAdapterError {
  return (
    e instanceof DigAdapterError && (code === undefined || (e as DigAdapterError).code === code)
  );
}

/**
 * Map a failure from the SDK deploy runner (which throws plain `Error`s in published versions) onto
 * a stable {@link DigAdapterError} code, so the plugin's publish boundary always surfaces a coded
 * error. The mapping is by the runner's well-known message prefixes; the original error is preserved
 * as `cause`. An already-coded error (a `DigAdapterError`, or anything carrying a `.code` string) is
 * passed through unchanged.
 */
export function toAdapterError(e: unknown): DigAdapterError {
  if (e instanceof DigAdapterError) return e;
  const message = e instanceof Error ? e.message : String(e);
  // The SDK runner may already carry a coded `.code` (newer versions throw DigSdkError); honor it.
  const existing =
    typeof e === "object" && e !== null && typeof (e as { code?: unknown }).code === "string"
      ? ((e as { code: string }).code as DigAdapterErrorCode)
      : undefined;
  const code: DigAdapterErrorCode =
    existing && existing in DIG_ADAPTER_ERROR_CODES
      ? existing
      : /is digstore installed|could not run|not on PATH|ENOENT/i.test(message)
        ? "DIGSTORE_NOT_FOUND"
        : /could not parse|did not report a capsule|malformed capsule/i.test(message)
          ? "DEPLOY_OUTPUT_UNPARSEABLE"
          : "DEPLOY_FAILED";
  return new DigAdapterError(code, message, {}, { cause: e });
}
