import { GatewayError } from "~/shared/utils/gateway";

/** A readable reason for a failed read, never a stack trace. */
/** Shown whenever the failure carries no usable explanation. */
export const GENERIC_LOAD_ERROR =
  "The service did not answer. Check your connection and try again.";

/** A readable, never empty, reason for a failed read; never a stack trace. */
export function describeLoadError(cause: unknown): string {
  const message = cause instanceof GatewayError ? cause.message.trim() : "";
  return message || GENERIC_LOAD_ERROR;
}
