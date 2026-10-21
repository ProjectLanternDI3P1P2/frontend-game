/**
 * Pure presentation rules for the leaderboard (ADR-FE-012, decisions D3/D4).
 */
import type { LeaderboardEntry, LeaderboardResponse, LeaderboardView } from "./types";

/** The leaderboard shows the top 50, never more (no pagination, D4). */
export const LEADERBOARD_LIMIT = 50;

function byRank(a: LeaderboardEntry, b: LeaderboardEntry): number {
  return a.rank - b.rank || a.playerName.localeCompare(b.playerName, "en");
}

/**
 * Sorts by ascending rank, keeps the top 50, flags the current player's line,
 * and pins it under the table when it is not among the displayed rows.
 */
export function buildLeaderboardView(
  response: Pick<LeaderboardResponse, "entries" | "me"> | null | undefined,
  currentPlayerId: string,
  limit: number = LEADERBOARD_LIMIT,
): LeaderboardView {
  // `me` answers for the requested player: trust it even if ids are formatted
  // differently, and recognise the current player by either id.
  const myIds = new Set([currentPlayerId, response?.me?.playerId].filter(Boolean));
  const rows = [...(response?.entries ?? [])]
    .sort(byRank)
    .slice(0, limit)
    .map((entry) => ({ ...entry, isMe: myIds.has(entry.playerId) }));

  const meInRows = rows.find((row) => row.isMe) ?? null;
  const reportedMe = response?.me ? { ...response.me, isMe: true } : null;

  return {
    rows,
    me: meInRows ?? reportedMe,
    pinnedMe: meInRows ? null : reportedMe,
  };
}
