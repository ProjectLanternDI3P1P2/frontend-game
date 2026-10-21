import { GatewayError } from "~/shared/utils/gateway";

/** A readable reason for a failed read, never a stack trace. */
export function describeLoadError(cause: unknown): string {
  if (cause instanceof GatewayError) return cause.message;
  return "The service did not answer. Check your connection and try again.";
}
