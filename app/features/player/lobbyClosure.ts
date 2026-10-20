/**
 * A lobby can be closed before its run starts (state `Abandoned`): PlayerHub then pushes a
 * `SessionStateChanged` snapshot to every member. The lobby page shows why, then sends the
 * player back to "Join a game".
 */
import type { GameSessionSnapshot } from "./types";

/** Seconds before a closed lobby redirects to "Join a game". */
export const CLOSED_LOBBY_REDIRECT_SECONDS = 5;

export function isClosedLobby(
  snapshot: Pick<GameSessionSnapshot, "state"> | null,
): boolean {
  return snapshot?.state === "Abandoned";
}

export function closedLobbyMessage(
  snapshot: Pick<GameSessionSnapshot, "failureReason">,
): string {
  return snapshot.failureReason === "HeroDeleted"
    ? "One of its heroes was deleted, so this lobby has been closed for every member."
    : "This lobby has been closed before its run started.";
}

export const joinGamePath = (playerId: string) =>
  `/players/${encodeURIComponent(playerId)}/play`;
