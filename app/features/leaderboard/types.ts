/**
 * Leaderboard capability — hand-written types (ADR-FE-011).
 *
 * PROVISIONAL CONTRACT (decision D1): the leaderboard service has not published
 * its Gateway contract yet. The two response shapes below mirror the agreed
 * draft and are the only thing to update, together with `api/leaderboardApi.ts`,
 * when the real contract lands.
 */

/** GET progression/players/{playerId}/heroes/{heroId}/statistics */
export interface HeroStatisticsResponse {
  heroId: string;
  /** ISO 8601, null when the hero has never been consolidated. */
  consolidatedAt: string | null;
  isConsolidating: boolean;
  /** Missing keys mean 0. */
  statistics: HeroStatisticValue[];
}

export interface HeroStatisticValue {
  key: string;
  value: number;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  score: number;
}

/** GET progression/leaderboard?limit=50&playerId={playerId} */
export interface LeaderboardResponse {
  consolidatedAt: string | null;
  entries: LeaderboardEntry[];
  me: LeaderboardEntry | null;
}

/** The typed boundary every page goes through, simulated or real. */
export interface LeaderboardApi {
  getHeroStatistics(
    playerId: string,
    heroId: string,
    signal?: AbortSignal,
  ): Promise<HeroStatisticsResponse>;
  getLeaderboard(playerId: string, signal?: AbortSignal): Promise<LeaderboardResponse>;
}

export enum LeaderboardSource {
  SIMULATED = "simulated",
  GATEWAY = "gateway",
}

/** Selected in simulated mode with `?mock=<scenario>`. */
export enum MockScenario {
  PLAYED = "played",
  EMPTY = "empty",
  CONSOLIDATING = "consolidating",
  ERROR = "error",
}

export enum StatisticCategory {
  GAMES = "games",
  DUNGEON = "dungeon",
  COMBAT = "combat",
  REWARDS = "rewards",
}

/** One entry of the front-end statistics catalogue. */
export interface StatisticDefinition {
  key: string;
  label: string;
  category: StatisticCategory;
}

/** A catalogue statistic with its cumulated value, ready to display. */
export interface HeroStatistic extends StatisticDefinition {
  value: number;
}

export interface StatisticGroup {
  category: StatisticCategory;
  label: string;
  statistics: HeroStatistic[];
}

export interface LeaderboardRow extends LeaderboardEntry {
  isMe: boolean;
}

export interface LeaderboardView {
  /** At most 50 rows, by ascending rank. */
  rows: LeaderboardRow[];
  /** The current player's line when outside the displayed rows, else null. */
  pinnedMe: LeaderboardRow | null;
  /** The current player's line, wherever it is. */
  me: LeaderboardRow | null;
}

export enum LoadStatus {
  LOADING = "loading",
  READY = "ready",
  EMPTY = "empty",
  ERROR = "error",
}

export interface ConsolidationInfo {
  consolidatedAt: string | null;
  /** "Updated 3 min ago", "Not consolidated yet"… */
  label: string;
  isConsolidating: boolean;
}
