/**
 * Leaderboard capability — hand-written types (ADR-FE-011).
 *
 * PROVISIONAL CONTRACT (decisions D1, D8): the leaderboard service has not
 * published its Gateway contract yet. The response shapes below mirror the
 * agreed draft (sheet F00) and are the only thing to update, together with
 * `api/leaderboardApi.ts`, when the real contract lands.
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

// ------------------------------------------------------------------ ranking
// PROVISIONAL CONTRACT (decisions D1, D8): one row per hero. Shared by F02, F03
// and F04; change it only together with `api/leaderboardApi.ts`.

export enum HeroClass {
  WARRIOR = "warrior",
  SHAMAN = "shaman",
  MAGE = "mage",
}
export enum RankingPeriod {
  ALL_TIME = "all-time",
  SEASON = "season",
  WEEK = "week",
}
export enum RankingSort {
  TOTAL_XP = "total-xp",
  LEVEL = "level",
  WIN_RATE = "win-rate",
  LAST_ACTIVITY = "last-activity",
}
export enum RankingStatus {
  LIVE = "live",
  LAGGING = "lagging",
  REBUILDING = "rebuilding",
  FROZEN = "frozen",
}
export enum RunOutcome {
  VICTORY = "victory",
  DEFEAT = "defeat",
  ABANDONED = "abandoned",
}
export enum FactStatus {
  APPLIED = "applied",
  PENDING = "pending",
  REJECTED = "rejected",
}

export interface RankingQuery {
  playerId: string; // joueur courant (D5)
  heroClass: HeroClass | null; // null = toutes les classes
  period: RankingPeriod; // défaut ALL_TIME
  search: string; // "" = pas de recherche (sur playerName ou heroName, insensible à la casse)
  sort: RankingSort; // défaut TOTAL_XP ; le rang affiché reste le rang par XP totale
  page: number; // à partir de 1
  pageSize: number; // 10
}

export interface RankingEntry {
  rank: number;
  rankDelta: number | null; // null = NEW ; >0 monte, <0 descend, 0 stable
  heroId: string;
  heroName: string;
  heroClass: HeroClass;
  level: number;
  totalXp: number;
  runs: number;
  winRate: number; // 0..1
  lastActivityAt: string | null; // ISO 8601
  playerId: string | null; // null si joueur supprimé
  playerName: string | null; // null = « Anonymous hero » / « Deleted hero »
  isPending: boolean; // XP en attente de consolidation (badge « XP pending »)
}

export interface RankingStatusDetail {
  lagSeconds: number | null; // LAGGING
  pendingCount: number | null; // LAGGING
  correctUpTo: string | null; // LAGGING : classement certain jusqu'à cette date
  rebuildProgress: number | null; // REBUILDING : 0..1
  snapshotAt: string | null; // REBUILDING : instantané affiché « as of »
  frozenAt: string | null; // FROZEN
  reason: string | null; // FROZEN / LAGGING : texte libre
}

export interface RankingSeason {
  id: string;
  label: string;
  openedAt: string;
  previousSeasonId: string | null;
}

// GET progression/leaderboard/heroes?playerId&class&period&search&sort&page&pageSize
export interface RankingResponse {
  consolidatedAt: string | null;
  status: RankingStatus;
  statusDetail: RankingStatusDetail;
  season: RankingSeason;
  page: number;
  pageSize: number;
  totalCount: number; // héros classés correspondant aux filtres
  entries: RankingEntry[]; // la page demandée, triée
  me: RankingEntry[]; // tous les héros du joueur courant correspondant aux filtres (peut être vide)
}

export interface RankingRun {
  outcome: RunOutcome;
  room: number;
  maxRoom: number;
  boss: string | null;
  xp: number;
  endedAt: string;
}
// GET progression/leaderboard/heroes/{heroId}
export interface RankingHeroDetail {
  heroId: string;
  heroName: string;
  heroClass: HeroClass;
  level: number;
  ngTier: number;
  createdAt: string;
  xpIntoLevel: number;
  xpForNextLevel: number;
  lastRuns: RankingRun[]; // au plus 4, le plus récent d'abord
  bossesDefeated: number;
  deepestRoom: number;
  playerId: string | null;
}

export interface RankingFact {
  factId: string;
  type: string;
  ingestedAt: string;
  status: FactStatus;
  xp: number;
  reason: string | null;
}
// GET progression/leaderboard/heroes/{heroId}/facts
export interface RankingFactsResponse {
  heroId: string;
  xpFromFacts: number;
  idempotencyKey: string;
  facts: RankingFact[];
}

// GET progression/leaderboard/public
export interface PublicRankingResponse {
  consolidatedAt: string | null;
  season: RankingSeason;
  totalCount: number;
  podium: RankingEntry[]; // 0 à 3
  leadersByClass: { heroClass: HeroClass; entry: RankingEntry | null }[];
  top: RankingEntry[]; // 10 premiers
}

/** The typed boundary every page goes through, simulated or real. */
export interface LeaderboardApi {
  getHeroStatistics(
    playerId: string,
    heroId: string,
    signal?: AbortSignal,
  ): Promise<HeroStatisticsResponse>; // F01, inchangé
  getRanking(query: RankingQuery, signal?: AbortSignal): Promise<RankingResponse>;
  getRankingHeroDetail(
    heroId: string,
    signal?: AbortSignal,
  ): Promise<RankingHeroDetail>;
  getRankingHeroFacts(
    heroId: string,
    signal?: AbortSignal,
  ): Promise<RankingFactsResponse>;
  getPublicRanking(signal?: AbortSignal): Promise<PublicRankingResponse>;
}

export enum LeaderboardSource {
  SIMULATED = "simulated",
  GATEWAY = "gateway",
}

/** Selected in simulated mode with `?mock=<scenario>`. */
export enum MockScenario {
  PLAYED = "played",
  EMPTY = "empty",
  LAGGING = "lagging",
  REBUILDING = "rebuilding",
  FROZEN = "frozen",
  ERROR = "error",
  /** Kept for the hero statistics page (F01). */
  CONSOLIDATING = "consolidating",
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
