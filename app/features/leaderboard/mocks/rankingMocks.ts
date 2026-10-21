/**
 * Simulated hero ranking (decisions D1, D8). Only `api/simulatedLeaderboardApi.ts`
 * imports `mocks/`; components never do.
 *
 * A deterministic population, built from `now` so that dates stay relative:
 * - 220 heroes ranked all time: the 120 heroes of the current season plus 100
 *   heroes who only played earlier seasons. The rank shown is always the rank
 *   by XP over the selected period (all time, season or week), whatever the
 *   class filter, the search or the sort.
 * - The current player (`SEEDED_PLAYER_ID`, D5) owns a Warrior ranked 7th, a
 *   Shaman ranked 58th and a Mage ranked 210th all time, the Mage being absent
 *   from the current season.
 * - Deleted players (`playerId`/`playerName` null), `rankDelta` null (NEW) or
 *   not, `isPending` lines, a hero who never ran (`lastActivityAt` null).
 *
 * Scenarios (`?mock=`): `played` (LIVE), `empty` (new season, nobody ranked),
 * `lagging`, `rebuilding`, `frozen`; `consolidating` answers like `played`
 * (it only matters for the hero statistics of F01); `error` is handled by the
 * simulated API.
 */
import { SEEDED_PLAYER_ID } from "~/features/player/seededPlayer";
import {
  FactStatus,
  HeroClass,
  MockScenario,
  RankingPeriod,
  RankingSort,
  RankingStatus,
  RunOutcome,
  type PublicRankingResponse,
  type RankingEntry,
  type RankingFact,
  type RankingFactsResponse,
  type RankingHeroDetail,
  type RankingQuery,
  type RankingResponse,
  type RankingRun,
  type RankingSeason,
  type RankingStatusDetail,
} from "../types";
import { CONSOLIDATED_MINUTES_AGO, minutesBefore } from "./leaderboardMocks";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Heroes ranked all time; 120 of them played the current season. */
export const SIMULATED_HERO_COUNT = 220;
const SEASON_DAYS = 30;
const XP_PER_LEVEL = 25_000;
const MAX_LEVEL = 60;
const MAX_ROOM = 12;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const FACTS_PER_HERO = 6;

export const MY_PLAYER_NAME = "MaelisRune";

/** All-time ranks of the current player's heroes. */
export const MY_HEROES = {
  warrior: { rank: 7, heroId: "simulated-hero-007", heroName: "Maelis the Warden" },
  shaman: { rank: 58, heroId: "simulated-hero-058", heroName: "Ysolde Stormcall" },
  mage: { rank: 210, heroId: "simulated-hero-210", heroName: "Quillon Ashveil" },
} as const;

/** All-time ranks whose player deleted their account. */
export const DELETED_PLAYER_RANKS: readonly number[] = [9, 73, 150];

/** A hero ranked from imported XP, who never finished a run. */
const NEVER_RAN_RANK = 199;

const PLAYER_NAMES = [
  "Aldric",
  "Brenna",
  "Corvin",
  "Dahlia",
  "Eamon",
  "Fenna",
  "Garrick",
  "Hestia",
  "Ivor",
  "Juna",
  "Kestrel",
  "Lorcan",
  "Mirela",
  "Nox",
  "Orla",
  "Perrin",
  "Quenby",
  "Rowan",
  "Sable",
  "Tamsin",
];

const HERO_FIRST_NAMES = [
  "Thorne",
  "Elowen",
  "Brakka",
  "Seraphine",
  "Draven",
  "Isolde",
  "Korrin",
  "Lyra",
  "Morwen",
  "Fenrick",
  "Astrid",
  "Galen",
  "Rhiannon",
  "Torvald",
  "Nyssa",
  "Cedric",
  "Yara",
  "Ulric",
  "Vesper",
  "Wren",
  "Zephyr",
  "Oona",
  "Halvard",
];

const HERO_TITLES = [
  "the Bold",
  "Ironhide",
  "of the Ash",
  "Duskblade",
  "the Wise",
  "Frostborn",
  "the Swift",
  "Emberheart",
  "Stoneward",
  "the Grey",
];

const BOSSES = ["The Hollow King", "Mire Matron", "Gravel Wyrm", "Lantern Lich"];
const FACT_TYPES = ["run.completed", "boss.defeated", "room.cleared", "run.abandoned"];
const CLASSES = [HeroClass.WARRIOR, HeroClass.SHAMAN, HeroClass.MAGE];

/** One hero of the population, before any period, filter or page applies. */
interface SimulatedHero {
  allTimeRank: number;
  heroId: string;
  heroName: string;
  heroClass: HeroClass;
  playerId: string | null;
  playerName: string | null;
  allTimeXp: number;
  seasonXp: number | null;
  weekXp: number | null;
  level: number;
  runs: number;
  /** Share of the all-time runs played in the season and in the week. */
  seasonShare: number;
  weekShare: number;
  winRate: number;
  lastActivityAt: string | null;
  createdAt: string;
}

const MY_RANKS = new Map<number, (typeof MY_HEROES)[keyof typeof MY_HEROES]>(
  Object.values(MY_HEROES).map((hero) => [hero.rank, hero]),
);
const MY_CLASSES = new Map<number, HeroClass>([
  [MY_HEROES.warrior.rank, HeroClass.WARRIOR],
  [MY_HEROES.shaman.rank, HeroClass.SHAMAN],
  [MY_HEROES.mage.rank, HeroClass.MAGE],
]);

function pad(rank: number): string {
  return String(rank).padStart(3, "0");
}

function before(now: Date, milliseconds: number): string {
  return new Date(now.getTime() - milliseconds).toISOString();
}

/** 6 of every 11 ranks played the season (120 of 220); the Mage did not. */
function playedSeason(rank: number): boolean {
  return ![1, 4, 6, 9, 10].includes(rank % 11);
}

/** Strictly decreasing with the rank, so the all-time order is unambiguous. */
function allTimeXp(rank: number): number {
  return 1_500_000 - (rank - 1) * 6_500 + ((rank * 7919) % 3000);
}

function owner(rank: number): Pick<SimulatedHero, "playerId" | "playerName"> {
  if (MY_RANKS.has(rank))
    return { playerId: SEEDED_PLAYER_ID, playerName: MY_PLAYER_NAME };
  if (DELETED_PLAYER_RANKS.includes(rank)) return { playerId: null, playerName: null };
  const index = (rank * 17) % 70;
  const name = PLAYER_NAMES[index % PLAYER_NAMES.length]!;
  return {
    playerId: `simulated-player-${pad(index)}`,
    playerName: index < PLAYER_NAMES.length ? name : `${name}${index}`,
  };
}

function lastActivity(rank: number, inSeason: boolean, now: Date): string | null {
  if (rank === MY_HEROES.warrior.rank) return before(now, 12 * SECOND);
  if (rank === MY_HEROES.shaman.rank) return before(now, 3 * DAY);
  if (rank === NEVER_RAN_RANK) return null;
  if (inSeason) return before(now, (((rank * 7919) % (13 * 24 * 60)) + 1) * MINUTE);
  return before(now, (SEASON_DAYS + 5 + ((rank * 13) % 120)) * DAY);
}

function buildHero(rank: number, now: Date): SimulatedHero {
  const mine = MY_RANKS.get(rank);
  const inSeason = playedSeason(rank) && rank !== MY_HEROES.mage.rank;
  const lastActivityAt = lastActivity(rank, inSeason, now);
  const activeThisWeek =
    inSeason &&
    lastActivityAt !== null &&
    now.getTime() - new Date(lastActivityAt).getTime() < 7 * DAY;

  const xp = allTimeXp(rank);
  // My Warrior played most of their XP this season (2nd of the season).
  const seasonShare =
    rank === MY_HEROES.warrior.rank ? 0.7 : 0.25 + ((rank * 37) % 50) / 100;
  const weekShare = 0.05 + ((rank * 53) % 20) / 100;
  const seasonXp = inSeason ? Math.round(xp * seasonShare) : null;

  return {
    allTimeRank: rank,
    heroId: mine?.heroId ?? `simulated-hero-${pad(rank)}`,
    heroName:
      mine?.heroName ??
      `${HERO_FIRST_NAMES[rank % HERO_FIRST_NAMES.length]} ${HERO_TITLES[rank % HERO_TITLES.length]}`,
    heroClass: MY_CLASSES.get(rank) ?? CLASSES[(rank * 7 + 1) % CLASSES.length]!,
    ...owner(rank),
    allTimeXp: xp,
    seasonXp,
    weekXp:
      activeThisWeek && seasonXp !== null ? Math.round(seasonXp * weekShare) : null,
    level: Math.min(MAX_LEVEL, 1 + Math.floor(xp / XP_PER_LEVEL)),
    runs: rank === NEVER_RAN_RANK ? 0 : 30 + ((rank * 13) % 170),
    seasonShare,
    weekShare,
    winRate: rank === MY_HEROES.warrior.rank ? 0.64 : 0.2 + ((rank * 29) % 60) / 100,
    lastActivityAt,
    createdAt: before(now, (inSeason ? 40 + (rank % 60) : 200 + rank) * DAY),
  };
}

/** The whole population, by all-time rank. */
export function simulatedHeroes(now: Date): SimulatedHero[] {
  return Array.from({ length: SIMULATED_HERO_COUNT }, (_, index) =>
    buildHero(index + 1, now),
  );
}

// ------------------------------------------------------------------ scenario

function currentSeason(scenario: MockScenario, now: Date): RankingSeason {
  return scenario === MockScenario.EMPTY
    ? {
        id: "season-4",
        label: "Season 4",
        openedAt: before(now, 2 * HOUR),
        previousSeasonId: "season-3",
      }
    : {
        id: "season-3",
        label: "Season 3",
        openedAt: before(now, SEASON_DAYS * DAY),
        previousSeasonId: "season-2",
      };
}

const NO_DETAIL: RankingStatusDetail = {
  lagSeconds: null,
  pendingCount: null,
  correctUpTo: null,
  rebuildProgress: null,
  snapshotAt: null,
  frozenAt: null,
  reason: null,
};

interface ScenarioState {
  consolidatedAt: string | null;
  status: RankingStatus;
  statusDetail: RankingStatusDetail;
}

function scenarioState(scenario: MockScenario, now: Date): ScenarioState {
  const consolidatedAt = minutesBefore(now, CONSOLIDATED_MINUTES_AGO);
  switch (scenario) {
    case MockScenario.EMPTY:
      return {
        consolidatedAt: null,
        status: RankingStatus.LIVE,
        statusDetail: NO_DETAIL,
      };
    case MockScenario.LAGGING:
      return {
        consolidatedAt,
        status: RankingStatus.LAGGING,
        statusDetail: {
          ...NO_DETAIL,
          lagSeconds: 420,
          pendingCount: 37,
          correctUpTo: minutesBefore(now, 7),
          reason: "Run events are being ingested slower than usual.",
        },
      };
    case MockScenario.REBUILDING: {
      const snapshotAt = minutesBefore(now, 2 * 60);
      return {
        consolidatedAt: snapshotAt,
        status: RankingStatus.REBUILDING,
        statusDetail: { ...NO_DETAIL, rebuildProgress: 0.62, snapshotAt },
      };
    }
    case MockScenario.FROZEN: {
      const frozenAt = minutesBefore(now, 6 * 60);
      return {
        consolidatedAt: frozenAt,
        status: RankingStatus.FROZEN,
        statusDetail: {
          ...NO_DETAIL,
          frozenAt,
          reason: "The season is closed while rewards are being audited.",
        },
      };
    }
    default:
      return { consolidatedAt, status: RankingStatus.LIVE, statusDetail: NO_DETAIL };
  }
}

/** A few lines always wait for consolidation; many more while lagging. */
function isPending(rank: number, scenario: MockScenario): boolean {
  if (rank === MY_HEROES.warrior.rank || rank % 29 === 4) return true;
  return scenario === MockScenario.LAGGING && rank % 6 === 1;
}

const PERIOD_OFFSET: Record<RankingPeriod, number> = {
  [RankingPeriod.ALL_TIME]: 0,
  [RankingPeriod.SEASON]: 1,
  [RankingPeriod.WEEK]: 2,
};

/** NEW (null) for 1 hero in 13, else between -6 and +5; my Warrior climbed 3. */
function rankDelta(rank: number, period: RankingPeriod): number | null {
  if (rank === MY_HEROES.warrior.rank && period === RankingPeriod.ALL_TIME) return 3;
  const value = (rank * 31 + PERIOD_OFFSET[period] * 17) % 13;
  return value === 0 ? null : value - 7;
}

function periodXp(hero: SimulatedHero, period: RankingPeriod): number | null {
  if (period === RankingPeriod.SEASON) return hero.seasonXp;
  if (period === RankingPeriod.WEEK) return hero.weekXp;
  return hero.allTimeXp;
}

function periodRuns(hero: SimulatedHero, period: RankingPeriod): number {
  if (period === RankingPeriod.ALL_TIME) return hero.runs;
  const share =
    period === RankingPeriod.SEASON
      ? hero.seasonShare
      : hero.seasonShare * hero.weekShare;
  return Math.max(1, Math.round(hero.runs * share));
}

/** Every hero ranked over `period`, by ascending rank (XP over the period). */
function rankedEntries(
  heroes: SimulatedHero[],
  period: RankingPeriod,
  scenario: MockScenario,
): RankingEntry[] {
  return heroes
    .flatMap((hero) => {
      const xp = periodXp(hero, period);
      return xp === null ? [] : [{ hero, xp }];
    })
    .sort((a, b) => b.xp - a.xp || a.hero.allTimeRank - b.hero.allTimeRank)
    .map(({ hero, xp }, index) => ({
      rank: index + 1,
      rankDelta: rankDelta(hero.allTimeRank, period),
      heroId: hero.heroId,
      heroName: hero.heroName,
      heroClass: hero.heroClass,
      level: hero.level,
      totalXp: xp,
      runs: periodRuns(hero, period),
      winRate: hero.winRate,
      lastActivityAt: hero.lastActivityAt,
      playerId: hero.playerId,
      playerName: hero.playerName,
      isPending: isPending(hero.allTimeRank, scenario),
    }));
}

function matchesSearch(entry: RankingEntry, search: string): boolean {
  if (!search) return true;
  return [entry.heroName, entry.playerName].some((name) =>
    name?.toLowerCase().includes(search),
  );
}

function activityTime(entry: RankingEntry): number {
  return entry.lastActivityAt ? new Date(entry.lastActivityAt).getTime() : -Infinity;
}

const SORTERS: Record<RankingSort, (a: RankingEntry, b: RankingEntry) => number> = {
  [RankingSort.TOTAL_XP]: (a, b) => a.rank - b.rank,
  [RankingSort.LEVEL]: (a, b) => b.level - a.level || a.rank - b.rank,
  [RankingSort.WIN_RATE]: (a, b) => b.winRate - a.winRate || a.rank - b.rank,
  [RankingSort.LAST_ACTIVITY]: (a, b) =>
    activityTime(b) - activityTime(a) || a.rank - b.rank,
};

function positiveInteger(value: number, fallback: number, max = Infinity): number {
  return Number.isFinite(value) && value >= 1
    ? Math.min(max, Math.floor(value))
    : fallback;
}

/** GET progression/leaderboard/heroes, simulated. */
export function simulatedRanking(
  scenario: MockScenario,
  query: RankingQuery,
  now: Date,
): RankingResponse {
  const state = scenarioState(scenario, now);
  const page = positiveInteger(query.page, 1);
  const pageSize = positiveInteger(query.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const heroes = scenario === MockScenario.EMPTY ? [] : simulatedHeroes(now);
  const search = query.search.trim().toLowerCase();

  const matching = rankedEntries(heroes, query.period, scenario)
    .filter((entry) => !query.heroClass || entry.heroClass === query.heroClass)
    .filter((entry) => matchesSearch(entry, search));
  const sorted = [...matching].sort(
    SORTERS[query.sort] ?? SORTERS[RankingSort.TOTAL_XP],
  );

  return {
    ...state,
    season: currentSeason(scenario, now),
    page,
    pageSize,
    totalCount: matching.length,
    entries: sorted.slice((page - 1) * pageSize, page * pageSize),
    me: matching.filter((entry) => entry.playerId === query.playerId),
  };
}

/** GET progression/leaderboard/public, simulated: the default (all-time) ranking. */
export function simulatedPublicRanking(
  scenario: MockScenario,
  now: Date,
): PublicRankingResponse {
  const heroes = scenario === MockScenario.EMPTY ? [] : simulatedHeroes(now);
  const entries = rankedEntries(heroes, RankingPeriod.ALL_TIME, scenario);
  return {
    consolidatedAt: scenarioState(scenario, now).consolidatedAt,
    season: currentSeason(scenario, now),
    totalCount: entries.length,
    podium: entries.slice(0, 3),
    leadersByClass: CLASSES.map((heroClass) => ({
      heroClass,
      entry: entries.find((entry) => entry.heroClass === heroClass) ?? null,
    })),
    top: entries.slice(0, 10),
  };
}

// ------------------------------------------------------------------ hero

function findHero(scenario: MockScenario, heroId: string, now: Date) {
  if (scenario === MockScenario.EMPTY) return null;
  return simulatedHeroes(now).find((hero) => hero.heroId === heroId) ?? null;
}

function lastRuns(hero: SimulatedHero): RankingRun[] {
  if (!hero.lastActivityAt) return [];
  const end = new Date(hero.lastActivityAt).getTime();
  const rank = hero.allTimeRank;
  return Array.from({ length: Math.min(4, hero.runs) }, (_, index) => {
    const cycle = (rank + index) % 5;
    const outcome =
      cycle < 3
        ? RunOutcome.VICTORY
        : cycle === 3
          ? RunOutcome.DEFEAT
          : RunOutcome.ABANDONED;
    const room =
      outcome === RunOutcome.VICTORY
        ? MAX_ROOM
        : outcome === RunOutcome.DEFEAT
          ? 4 + ((rank + index) % 8)
          : 1 + ((rank + index) % 5);
    const boss =
      outcome === RunOutcome.VICTORY || (outcome === RunOutcome.DEFEAT && room >= 10)
        ? BOSSES[(rank + index) % BOSSES.length]!
        : null;
    const xp =
      outcome === RunOutcome.VICTORY
        ? 1200 + ((rank * (index + 1)) % 800)
        : outcome === RunOutcome.DEFEAT
          ? 400
          : 0;
    return {
      outcome,
      room,
      maxRoom: MAX_ROOM,
      boss,
      xp,
      endedAt: new Date(end - index * (3 * HOUR + rank * MINUTE)).toISOString(),
    };
  });
}

/** GET progression/leaderboard/heroes/{heroId}, simulated; null when unknown. */
export function simulatedHeroDetail(
  scenario: MockScenario,
  heroId: string,
  now: Date,
): RankingHeroDetail | null {
  const hero = findHero(scenario, heroId, now);
  if (!hero) return null;
  const bossesDefeated = Math.floor(hero.runs * hero.winRate);
  const atMaxLevel = hero.level >= MAX_LEVEL;
  return {
    heroId: hero.heroId,
    heroName: hero.heroName,
    heroClass: hero.heroClass,
    level: hero.level,
    ngTier: Math.floor(hero.level / 30),
    createdAt: hero.createdAt,
    xpIntoLevel: atMaxLevel ? XP_PER_LEVEL : hero.allTimeXp % XP_PER_LEVEL,
    xpForNextLevel: XP_PER_LEVEL,
    lastRuns: lastRuns(hero),
    bossesDefeated,
    deepestRoom:
      hero.runs === 0 ? 0 : bossesDefeated > 0 ? MAX_ROOM : 3 + (hero.allTimeRank % 8),
    playerId: hero.playerId,
  };
}

/**
 * GET progression/leaderboard/heroes/{heroId}/facts, simulated; null when
 * unknown. The 6 latest facts, newest first: the newest is still pending for a
 * hero whose line is pending; one in five heroes (and my Warrior) has a
 * rejected duplicate. `xpFromFacts` is the all-time XP the ranking shows.
 */
export function simulatedHeroFacts(
  scenario: MockScenario,
  heroId: string,
  now: Date,
): RankingFactsResponse | null {
  const hero = findHero(scenario, heroId, now);
  if (!hero) return null;
  const rank = hero.allTimeRank;
  const latest = new Date(hero.lastActivityAt ?? hero.createdAt).getTime();
  const pending = isPending(rank, scenario);
  const rejects = rank % 5 === 0 || rank === MY_HEROES.warrior.rank;

  const facts: RankingFact[] = Array.from({ length: FACTS_PER_HERO }, (_, index) => {
    const status =
      index === 0 && pending
        ? FactStatus.PENDING
        : index === 2 && rejects
          ? FactStatus.REJECTED
          : FactStatus.APPLIED;
    return {
      factId: `${hero.heroId}-fact-${FACTS_PER_HERO - index}`,
      type:
        hero.runs === 0
          ? "xp.imported"
          : FACT_TYPES[(rank + index) % FACT_TYPES.length]!,
      ingestedAt: new Date(latest - index * 47 * MINUTE).toISOString(),
      status,
      xp: 150 + ((rank * (index + 3)) % 9) * 50,
      reason:
        status === FactStatus.REJECTED
          ? "Duplicate event: this idempotency key was already applied."
          : status === FactStatus.PENDING
            ? "Waiting for the next consolidation."
            : null,
    };
  });

  return {
    heroId: hero.heroId,
    xpFromFacts: hero.allTimeXp,
    idempotencyKey: `rebuild:${hero.heroId}:${facts[0]!.factId}`,
    facts,
  };
}
