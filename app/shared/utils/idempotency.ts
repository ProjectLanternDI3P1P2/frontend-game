/**
 * Returns a fresh UUID to persist for one retriable business action.
 *
 * Callers keep the returned key while retrying the same action; generating a
 * second key represents a new intent. Player's write endpoints require this.
 */
export function createIdempotencyKey(): string {
  return crypto.randomUUID();
}
