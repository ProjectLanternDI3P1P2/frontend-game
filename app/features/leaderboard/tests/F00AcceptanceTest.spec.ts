/**
 * F00 — Fondation du classement par héros (contrat, clients, données simulées,
 * règles). Acceptance tests written from the feature sheet's criteria (CA1–CA9)
 * and its shared contract, not from the implementation.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
  type Component,
} from "vue";
import { createLeaderboardApi } from "../api/leaderboardApi";
import { LEADERBOARD_API_KEY, resolveMockScenario } from "../api/leaderboardSource";
import { createSimulatedLeaderboardApi } from "../api/simulatedLeaderboardApi";
import RankingRowDetail from "../components/RankingRowDetail.vue";
import {
  HERO_CLASS_LABELS,
  RANKING_PERIOD_LABELS,
  RANKING_SORT_LABELS,
  displayPlayerName,
  formatRankDelta,
  formatRelativeTime,
  formatWinRate,
  parseRankingQuery,
  podiumMedal,
  positionsBetween,
  toRouteQuery,
} from "../leaderboardRules";
import {
  FactStatus,
  HeroClass,
  MockScenario,
  RankingPeriod,
  RankingSort,
  RankingStatus,
  RunOutcome,
  type HeroStatisticValue,
  type HeroStatisticsResponse,
  type LeaderboardApi,
  type RankingEntry,
  type RankingQuery,
  type RankingResponse,
} from "../types";
import { GatewayError, createGatewayClient } from "~/shared/utils/gateway";
import type { GatewayClient } from "~/shared/utils/gateway";
import LeaderboardPage from "~/pages/leaderboard.vue";
import { SEEDED_PLAYER_ID } from "~/features/player/seededPlayer";

const ROOT = join(__dirname, "../../../..");
const FEATURE_DIR = join(ROOT, "app/features/leaderboard");
const SHEET = join(ROOT, "docs/features/F00-leaderboard-ranking-foundation.md");
const NOW = new Date("2026-10-21T12:00:00.000Z");
const ME = SEEDED_PLAYER_ID;

const stubs = {
  NuxtLink: { props: ["to"], template: '<a :href="to"><slot /></a>' },
  UiIconButton: true,
};

// ---------------------------------------------------------------- helpers

function query(overrides: Partial<RankingQuery> = {}): RankingQuery {
  return {
    playerId: ME,
    heroClass: null,
    period: RankingPeriod.ALL_TIME,
    search: "",
    sort: RankingSort.TOTAL_XP,
    page: 1,
    pageSize: 10,
    ...overrides,
  };
}

function simulated(scenario: MockScenario = MockScenario.PLAYED): LeaderboardApi {
  return createSimulatedLeaderboardApi({ scenario, delayMs: 0, now: () => NOW });
}

/** Every ranked hero matching the filters, page after page (pageSize 10). */
async function allPages(
  api: LeaderboardApi,
  overrides: Partial<RankingQuery> = {},
): Promise<{ first: RankingResponse; entries: RankingEntry[] }> {
  const first = await api.getRanking(query({ ...overrides, page: 1 }));
  const entries = [...first.entries];
  const pages = Math.ceil(first.totalCount / 10);
  for (let page = 2; page <= pages; page += 1) {
    const next = await api.getRanking(query({ ...overrides, page }));
    entries.push(...next.entries);
  }
  return { first, entries };
}

function recordingClient() {
  const get = vi.fn().mockResolvedValue({});
  const client = {
    request: vi.fn(),
    get,
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  } as unknown as GatewayClient;
  return { client, get };
}

function fetchingClient() {
  const fetchImpl = vi.fn().mockImplementation(
    async () =>
      new Response("{}", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );
  const client = createGatewayClient({
    baseUrl: "",
    apiVersion: "v1",
    fetchImpl: fetchImpl as unknown as typeof fetch,
    correlationIdFactory: () => "cid",
  });
  const urls = () => fetchImpl.mock.calls.map((call) => String(call[0]));
  return { client, urls };
}

function searchParams(url: string): URLSearchParams {
  return new URL(url, "http://x.invalid").searchParams;
}

function pathOf(url: string): string {
  return new URL(url, "http://x.invalid").pathname;
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** `export enum|interface Name … }` blocks of a TypeScript source, by name. */
function declarations(source: string): Map<string, string> {
  const result = new Map<string, string>();
  const pattern = /^export (?:enum|interface) (\w+)[^{]*\{[\s\S]*?^\}/gm;
  for (const match of source.matchAll(pattern)) {
    result.set(match[1]!, stripComments(match[0]));
  }
  return result;
}

function contractSource(): string {
  const sheet = readFileSync(SHEET, "utf8");
  const start = sheet.indexOf("### Contrat de données provisoire");
  expect(start, "contract section in the sheet").toBeGreaterThan(-1);
  const block = sheet.slice(start).match(/```ts\n([\s\S]*?)```/);
  expect(block, "contract code block").not.toBeNull();
  return block![1]!;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

let route: { params: Record<string, string>; query: Record<string, unknown> };

function mountPage(page: Component, api?: LeaderboardApi) {
  return mount(page, {
    global: {
      stubs,
      provide: api ? { [LEADERBOARD_API_KEY as symbol]: api } : {},
    },
  });
}

async function elapse(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  await flushPromises();
}

beforeEach(() => {
  route = reactive({ params: {}, query: {} });
  vi.stubGlobal("useRoute", () => route);
  vi.stubGlobal("definePageMeta", vi.fn());
  vi.stubGlobal("useHead", vi.fn());
  vi.stubGlobal("navigateTo", vi.fn());
  vi.stubGlobal("useRuntimeConfig", () => ({
    public: { appVersion: "test", commitSha: "abc" },
  }));
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("watch", watch);
  vi.stubGlobal("onMounted", onMounted);
  vi.stubGlobal("onBeforeUnmount", onBeforeUnmount);
  vi.stubGlobal("nextTick", nextTick);
  vi.stubGlobal("useState", (_key: string, init?: () => unknown) => ref(init?.()));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("F00", () => {
  // ================================================================== CA1
  describe("CA1 — types.ts holds exactly the shared contract; F01 types unchanged", () => {
    const types = readFileSync(join(FEATURE_DIR, "types.ts"), "utf8");

    it("CA1: every enum and interface of the contract is declared identically", () => {
      const expected = declarations(contractSource());
      const actual = declarations(types);
      expect([...expected.keys()].sort()).toEqual(
        [
          "FactStatus",
          "HeroClass",
          "LeaderboardApi",
          "PublicRankingResponse",
          "RankingEntry",
          "RankingFact",
          "RankingFactsResponse",
          "RankingHeroDetail",
          "RankingPeriod",
          "RankingQuery",
          "RankingResponse",
          "RankingRun",
          "RankingSeason",
          "RankingSort",
          "RankingStatus",
          "RankingStatusDetail",
          "RunOutcome",
        ].sort(),
      );
      for (const [name, body] of expected) {
        expect(actual.get(name), `declaration ${name}`).toBe(body);
      }
    });

    it("CA1: enum runtime values match the contract", () => {
      expect({ ...HeroClass }).toEqual({
        WARRIOR: "warrior",
        SHAMAN: "shaman",
        MAGE: "mage",
      });
      expect({ ...RankingPeriod }).toEqual({
        ALL_TIME: "all-time",
        SEASON: "season",
        WEEK: "week",
      });
      expect({ ...RankingSort }).toEqual({
        TOTAL_XP: "total-xp",
        LEVEL: "level",
        WIN_RATE: "win-rate",
        LAST_ACTIVITY: "last-activity",
      });
      expect({ ...RankingStatus }).toEqual({
        LIVE: "live",
        LAGGING: "lagging",
        REBUILDING: "rebuilding",
        FROZEN: "frozen",
      });
      expect({ ...RunOutcome }).toEqual({
        VICTORY: "victory",
        DEFEAT: "defeat",
        ABANDONED: "abandoned",
      });
      expect({ ...FactStatus }).toEqual({
        APPLIED: "applied",
        PENDING: "pending",
        REJECTED: "rejected",
      });
    });

    it("CA1: the old LeaderboardEntry, LeaderboardResponse and getLeaderboard are gone", () => {
      const code = stripComments(types);
      expect(code).not.toMatch(/\bLeaderboardEntry\b/);
      expect(code).not.toMatch(/\bLeaderboardResponse\b/);
      expect(code).not.toMatch(/\bgetLeaderboard\b/);
      expect(code).not.toMatch(/\bLeaderboardRow\b/);
    });

    it("CA1: F01 statistics types keep their shape", () => {
      const actual = declarations(types);
      expect(actual.get("HeroStatisticsResponse")).toBe(
        stripComments(`export interface HeroStatisticsResponse {
          heroId: string;
          consolidatedAt: string | null;
          isConsolidating: boolean;
          statistics: HeroStatisticValue[];
        }`),
      );
      expect(actual.get("HeroStatisticValue")).toBe(
        stripComments(`export interface HeroStatisticValue {
          key: string;
          value: number;
        }`),
      );
      expectTypeOf<HeroStatisticsResponse>().toEqualTypeOf<{
        heroId: string;
        consolidatedAt: string | null;
        isConsolidating: boolean;
        statistics: HeroStatisticValue[];
      }>();
      expectTypeOf<LeaderboardApi["getHeroStatistics"]>().toEqualTypeOf<
        (
          playerId: string,
          heroId: string,
          signal?: AbortSignal,
        ) => Promise<HeroStatisticsResponse>
      >();
    });
  });

  // ================================================================== CA2
  describe("CA2 — Gateway client: contract routes, encoded segments, query", () => {
    it("CA2: getRanking calls progression/leaderboard/heroes with every parameter", async () => {
      const { client, get } = recordingClient();
      const signal = new AbortController().signal;
      await createLeaderboardApi(client).getRanking(
        query({
          heroClass: HeroClass.SHAMAN,
          period: RankingPeriod.WEEK,
          search: "Maelis",
          sort: RankingSort.WIN_RATE,
          page: 3,
          pageSize: 10,
        }),
        signal,
      );

      expect(get).toHaveBeenCalledTimes(1);
      const [path, request] = get.mock.calls[0]!;
      expect(path).toBe("progression/leaderboard/heroes");
      expect(request.signal).toBe(signal);
      expect(
        Object.fromEntries(
          Object.entries(request.query).map(([k, v]) => [k, String(v)]),
        ),
      ).toEqual({
        playerId: ME,
        class: "shaman",
        period: "week",
        search: "Maelis",
        sort: "win-rate",
        page: "3",
        pageSize: "10",
      });
    });

    it("CA2: class is omitted for null, search when empty (final URL)", async () => {
      const { client, urls } = fetchingClient();
      await createLeaderboardApi(client).getRanking(query());
      const url = urls()[0]!;
      expect(pathOf(url)).toBe("/api/v1/progression/leaderboard/heroes");
      const params = searchParams(url);
      expect(params.has("class")).toBe(false);
      expect(params.has("search")).toBe(false);
      expect(Object.fromEntries(params)).toEqual({
        playerId: ME,
        period: "all-time",
        sort: "total-xp",
        page: "1",
        pageSize: "10",
      });
    });

    it("CA2 (edge): a whitespace-only search is not sent", async () => {
      const { client, urls } = fetchingClient();
      await createLeaderboardApi(client).getRanking(query({ search: "   " }));
      expect(searchParams(urls()[0]!).has("search")).toBe(false);
    });

    it("CA2 (edge): special characters in search and playerId are URL-encoded", async () => {
      const { client, urls } = fetchingClient();
      await createLeaderboardApi(client).getRanking(
        query({ playerId: "p&x=1", search: "a&b=c#d" }),
      );
      const params = searchParams(urls()[0]!);
      expect(params.get("search")).toBe("a&b=c#d");
      expect(params.get("playerId")).toBe("p&x=1");
      expect(params.has("x")).toBe(false);
    });

    it("CA2: detail and facts encode the heroId segment", async () => {
      const { client, urls } = fetchingClient();
      const api = createLeaderboardApi(client);
      await api.getRankingHeroDetail("a/b?c#d e");
      await api.getRankingHeroFacts("a/b?c#d e");
      const [detail, facts] = urls();
      expect(detail).toBe("/api/v1/progression/leaderboard/heroes/a%2Fb%3Fc%23d%20e");
      expect(facts).toBe(
        "/api/v1/progression/leaderboard/heroes/a%2Fb%3Fc%23d%20e/facts",
      );
    });

    it("CA2: getPublicRanking calls progression/leaderboard/public", async () => {
      const { client, urls } = fetchingClient();
      await createLeaderboardApi(client).getPublicRanking();
      expect(urls()).toEqual(["/api/v1/progression/leaderboard/public"]);
    });

    it("CA2: signals reach the transport for detail, facts and public", async () => {
      const { client, get } = recordingClient();
      const api = createLeaderboardApi(client);
      const signal = new AbortController().signal;
      await api.getRankingHeroDetail("h", signal);
      await api.getRankingHeroFacts("h", signal);
      await api.getPublicRanking(signal);
      for (const call of get.mock.calls) expect(call[1]?.signal).toBe(signal);
    });

    it("CA2: getHeroStatistics (F01) keeps its route", async () => {
      const { client, urls } = fetchingClient();
      await createLeaderboardApi(client).getHeroStatistics("p/1", "h 1");
      expect(urls()).toEqual([
        "/api/v1/progression/players/p%2F1/heroes/h%201/statistics",
      ]);
    });
  });

  // ================================================================== CA3
  describe("CA3 — simulated client: filters, period, search, sort, pagination", () => {
    it("CA3: the class filter keeps only that class; totals add up", async () => {
      const api = simulated();
      const all = await api.getRanking(query());
      let sum = 0;
      for (const heroClass of Object.values(HeroClass)) {
        const { first, entries } = await allPages(api, { heroClass });
        expect(entries.length).toBe(first.totalCount);
        expect(entries.every((entry) => entry.heroClass === heroClass)).toBe(true);
        expect(first.me.every((entry) => entry.heroClass === heroClass)).toBe(true);
        sum += first.totalCount;
      }
      expect(sum).toBe(all.totalCount);
    });

    it("CA3: the period changes the ranked population and the ranks", async () => {
      const api = simulated();
      const allTime = await api.getRanking(query());
      const season = await api.getRanking(query({ period: RankingPeriod.SEASON }));
      const week = await api.getRanking(query({ period: RankingPeriod.WEEK }));
      expect(season.totalCount).toBeLessThan(allTime.totalCount);
      expect(week.totalCount).toBeLessThanOrEqual(season.totalCount);
      expect(season.totalCount).toBeGreaterThan(0);
      // Ranks start at 1 on every period.
      expect(season.entries[0]!.rank).toBe(1);
      expect(week.entries[0]?.rank ?? 1).toBe(1);
      expect(season.me.map((e) => e.heroClass)).not.toContain(HeroClass.MAGE);
    });

    it("CA3: search is case-insensitive on the player name", async () => {
      const api = simulated();
      const lower = await api.getRanking(query({ search: "maelisrune" }));
      const upper = await api.getRanking(query({ search: "MAELISRUNE" }));
      expect(lower.totalCount).toBe(3);
      expect(upper.totalCount).toBe(3);
      expect(lower.entries.every((e) => e.playerId === ME)).toBe(true);
      expect(lower.me).toHaveLength(3);
    });

    it("CA3: search is case-insensitive on the hero name, partial match", async () => {
      const api = simulated();
      const { entries } = await allPages(api);
      const target = entries.find((e) => e.playerId !== ME && e.playerName)!;
      const fragment = target.heroName.slice(1, 6).toUpperCase();
      const { first, entries: found } = await allPages(api, { search: fragment });
      expect(found.map((e) => e.heroId)).toContain(target.heroId);
      expect(
        found.every(
          (e) =>
            e.heroName.toLowerCase().includes(fragment.toLowerCase()) ||
            (e.playerName ?? "").toLowerCase().includes(fragment.toLowerCase()),
        ),
      ).toBe(true);
      expect(first.totalCount).toBe(found.length);
    });

    it("CA3 (edge): a search without match gives totalCount 0, no entry, no me", async () => {
      const response = await simulated().getRanking(query({ search: "zzzz-nobody" }));
      expect(response.totalCount).toBe(0);
      expect(response.entries).toEqual([]);
      expect(response.me).toEqual([]);
    });

    it("CA3: TOTAL_XP sort is by ascending rank and descending XP", async () => {
      const { entries } = await allPages(simulated());
      const ranks = entries.map((e) => e.rank);
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
      expect(ranks[0]).toBe(1);
      for (let i = 1; i < entries.length; i += 1) {
        expect(entries[i]!.totalXp).toBeLessThanOrEqual(entries[i - 1]!.totalXp);
      }
    });

    it.each([
      [RankingSort.LEVEL, (e: RankingEntry) => e.level],
      [RankingSort.WIN_RATE, (e: RankingEntry) => e.winRate],
      [
        RankingSort.LAST_ACTIVITY,
        (e: RankingEntry) =>
          e.lastActivityAt ? new Date(e.lastActivityAt).getTime() : -Infinity,
      ],
    ])("CA3: sort %s orders descending, keeping the XP rank", async (sort, key) => {
      const api = simulated();
      const byXp = new Map(
        (await allPages(api)).entries.map((e) => [e.heroId, e.rank]),
      );
      const { first, entries } = await allPages(api, { sort });
      expect(entries).toHaveLength(first.totalCount);
      for (let i = 1; i < entries.length; i += 1) {
        expect(key(entries[i]!)).toBeLessThanOrEqual(key(entries[i - 1]!));
      }
      // The rank shown stays the rank by total XP.
      for (const entry of entries) expect(entry.rank).toBe(byXp.get(entry.heroId));
    });

    it("CA3: pagination slices by pageSize without overlap or gap", async () => {
      const api = simulated();
      const page1 = await api.getRanking(query({ page: 1 }));
      const page2 = await api.getRanking(query({ page: 2 }));
      expect(page1.page).toBe(1);
      expect(page2.page).toBe(2);
      expect(page1.pageSize).toBe(10);
      expect(page1.entries).toHaveLength(10);
      expect(page2.entries.map((e) => e.rank)).toEqual(
        Array.from({ length: 10 }, (_, i) => i + 11),
      );
      const { entries } = await allPages(api);
      expect(new Set(entries.map((e) => e.heroId)).size).toBe(page1.totalCount);
    });

    it("CA3 (edge): the last page is partial, a page past the end is empty", async () => {
      const api = simulated();
      const first = await api.getRanking(query());
      const lastPage = Math.ceil(first.totalCount / 10);
      const last = await api.getRanking(query({ page: lastPage }));
      expect(last.entries.length).toBe(first.totalCount - (lastPage - 1) * 10);
      const past = await api.getRanking(query({ page: lastPage + 1 }));
      expect(past.entries).toEqual([]);
      expect(past.totalCount).toBe(first.totalCount);
    });

    it("CA3: me holds all my matching heroes, wherever the page", async () => {
      const api = simulated();
      const far = await api.getRanking(query({ page: 5 }));
      expect(far.me).toHaveLength(3);
      expect(far.me.every((e) => e.playerId === ME)).toBe(true);
      const warriors = await api.getRanking(query({ heroClass: HeroClass.WARRIOR }));
      expect(warriors.me.map((e) => e.heroClass)).toEqual([HeroClass.WARRIOR]);
      const searchShaman = await api.getRanking(
        query({ search: "maelisrune", heroClass: HeroClass.SHAMAN }),
      );
      expect(searchShaman.totalCount).toBe(1);
      expect(searchShaman.me).toHaveLength(1);
    });

    it("CA3 (edge): another player gets their own me (empty for an unknown one)", async () => {
      const response = await simulated().getRanking(query({ playerId: "nobody" }));
      expect(response.me).toEqual([]);
      expect(response.totalCount).toBeGreaterThan(0);
    });

    it("CA3: me entries carry the same rank as in the ranking", async () => {
      const api = simulated();
      const { first, entries } = await allPages(api);
      const byId = new Map(entries.map((e) => [e.heroId, e]));
      for (const mine of first.me) expect(byId.get(mine.heroId)).toEqual(mine);
    });
  });

  // ================================================================== CA4
  describe("CA4 — ?mock= scenarios", () => {
    it("CA4: played (default) is LIVE with ranked heroes", async () => {
      const response = await simulated(MockScenario.PLAYED).getRanking(query());
      expect(response.status).toBe(RankingStatus.LIVE);
      expect(response.totalCount).toBeGreaterThan(0);
      expect(response.consolidatedAt).not.toBeNull();
    });

    it("CA4: empty → totalCount 0, new season with previousSeasonId", async () => {
      const api = simulated(MockScenario.EMPTY);
      const response = await api.getRanking(query());
      expect(response.totalCount).toBe(0);
      expect(response.entries).toEqual([]);
      expect(response.me).toEqual([]);
      expect(response.season.previousSeasonId).toEqual(expect.any(String));
      expect(response.season.previousSeasonId).not.toBe(response.season.id);
      const publicRanking = await api.getPublicRanking();
      expect(publicRanking.totalCount).toBe(0);
      expect(publicRanking.podium).toEqual([]);
      expect(publicRanking.top).toEqual([]);
    });

    it("CA4: lagging → LAGGING, details filled, some pending lines", async () => {
      const api = simulated(MockScenario.LAGGING);
      const response = await api.getRanking(query());
      expect(response.status).toBe(RankingStatus.LAGGING);
      expect(response.statusDetail.lagSeconds).toEqual(expect.any(Number));
      expect(response.statusDetail.pendingCount).toEqual(expect.any(Number));
      expect(response.statusDetail.correctUpTo).toEqual(expect.any(String));
      expect(Number.isNaN(Date.parse(response.statusDetail.correctUpTo!))).toBe(false);
      expect(response.statusDetail.reason).toEqual(expect.any(String));
      const { entries } = await allPages(api);
      expect(entries.some((e) => e.isPending)).toBe(true);
    });

    it("CA4: rebuilding → REBUILDING, progress 0.62, snapshotAt filled", async () => {
      const response = await simulated(MockScenario.REBUILDING).getRanking(query());
      expect(response.status).toBe(RankingStatus.REBUILDING);
      expect(response.statusDetail.rebuildProgress).toBe(0.62);
      expect(response.statusDetail.snapshotAt).toEqual(expect.any(String));
      expect(Number.isNaN(Date.parse(response.statusDetail.snapshotAt!))).toBe(false);
    });

    it("CA4: frozen → FROZEN", async () => {
      const response = await simulated(MockScenario.FROZEN).getRanking(query());
      expect(response.status).toBe(RankingStatus.FROZEN);
      expect(response.statusDetail.frozenAt).toEqual(expect.any(String));
    });

    it("CA4: error → every method fails with a GatewayError", async () => {
      const api = simulated(MockScenario.ERROR);
      const calls: Array<() => Promise<unknown>> = [
        () => api.getHeroStatistics(ME, "simulated-hero-007"),
        () => api.getRanking(query()),
        () => api.getRankingHeroDetail("simulated-hero-007"),
        () => api.getRankingHeroFacts("simulated-hero-007"),
        () => api.getPublicRanking(),
      ];
      for (const call of calls) {
        await expect(call()).rejects.toBeInstanceOf(GatewayError);
      }
    });

    it("CA4: consolidating is kept for the F01 statistics", async () => {
      const api = simulated(MockScenario.CONSOLIDATING);
      const stats = await api.getHeroStatistics(ME, "hero-1");
      expect(stats.isConsolidating).toBe(true);
      const ranking = await api.getRanking(query());
      expect(ranking.totalCount).toBeGreaterThan(0);
    });

    it("CA4: ?mock= resolves to the scenario; default and unknown values → played", () => {
      for (const scenario of Object.values(MockScenario)) {
        expect(resolveMockScenario(scenario)).toBe(scenario);
      }
      expect(resolveMockScenario(undefined)).toBe(MockScenario.PLAYED);
      expect(resolveMockScenario("")).toBe(MockScenario.PLAYED);
      expect(resolveMockScenario("bogus")).toBe(MockScenario.PLAYED);
      expect(resolveMockScenario("EMPTY")).toBe(MockScenario.PLAYED);
      expect(resolveMockScenario(42)).toBe(MockScenario.PLAYED);
      expect(resolveMockScenario(null)).toBe(MockScenario.PLAYED);
    });

    it("CA4: the whole set of ?mock= values is the contract's", () => {
      expect(Object.values(MockScenario).sort()).toEqual(
        [
          "played",
          "empty",
          "lagging",
          "rebuilding",
          "frozen",
          "error",
          "consolidating",
        ].sort(),
      );
    });

    it("CA4: on /leaderboard, ?mock=error shows an alert, ?mock=empty the empty state, unknown → played", async () => {
      vi.useFakeTimers();
      route.query = { mock: "error" };
      const failed = mountPage(LeaderboardPage);
      route.query = { mock: "empty" };
      const empty = mountPage(LeaderboardPage);
      route.query = { mock: "nope" };
      const fallback = mountPage(LeaderboardPage);
      await elapse(400);

      expect(failed.find('[role="alert"]').exists()).toBe(true);
      expect(failed.find("table").exists()).toBe(false);
      expect(empty.find("table").exists()).toBe(false);
      expect(empty.find('[role="alert"]').exists()).toBe(false);
      expect(empty.text()).toMatch(/no hero/i);
      expect(fallback.findAll("tbody tr")).toHaveLength(10);
      expect(fallback.find('[role="alert"]').exists()).toBe(false);
    });

    it("CA4: the simulated delay is about 300 ms", async () => {
      vi.useFakeTimers();
      const api = createSimulatedLeaderboardApi({ scenario: MockScenario.PLAYED });
      let done = false;
      void api.getRanking(query()).then(() => {
        done = true;
      });
      await vi.advanceTimersByTimeAsync(200);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(200);
      expect(done).toBe(true);
    });

    it("CA4: detail, facts and public are consistent with the ranking", async () => {
      const api = simulated();
      const { first, entries } = await allPages(api);
      for (const entry of [entries[0]!, ...first.me]) {
        const detail = await api.getRankingHeroDetail(entry.heroId);
        expect(detail.heroId).toBe(entry.heroId);
        expect(detail.heroName).toBe(entry.heroName);
        expect(detail.heroClass).toBe(entry.heroClass);
        expect(detail.level).toBe(entry.level);
        expect(detail.playerId).toBe(entry.playerId);
        expect(detail.lastRuns.length).toBeLessThanOrEqual(4);
        const times = detail.lastRuns.map((run) => Date.parse(run.endedAt));
        expect(times).toEqual([...times].sort((a, b) => b - a));
        const facts = await api.getRankingHeroFacts(entry.heroId);
        expect(facts.heroId).toBe(entry.heroId);
      }

      const publicRanking = await api.getPublicRanking();
      expect(publicRanking.totalCount).toBe(first.totalCount);
      expect(publicRanking.podium.map((e) => e.heroId)).toEqual(
        entries.slice(0, 3).map((e) => e.heroId),
      );
      expect(publicRanking.top.map((e) => e.heroId)).toEqual(
        entries.slice(0, 10).map((e) => e.heroId),
      );
      for (const { heroClass, entry } of publicRanking.leadersByClass) {
        const leader = entries.find((e) => e.heroClass === heroClass) ?? null;
        expect(entry?.heroId ?? null).toBe(leader?.heroId ?? null);
      }
      expect(publicRanking.leadersByClass.map((l) => l.heroClass).sort()).toEqual(
        Object.values(HeroClass).sort(),
      );
    });

    it("CA4: at least one hero has rejected and pending facts", async () => {
      const api = simulated();
      const { entries } = await allPages(api);
      let found = false;
      for (const entry of entries) {
        const { facts } = await api.getRankingHeroFacts(entry.heroId);
        const statuses = new Set(facts.map((fact) => fact.status));
        if (statuses.has(FactStatus.REJECTED) && statuses.has(FactStatus.PENDING)) {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    });

    it("CA4 (edge): an unknown hero's detail and facts fail, not crash", async () => {
      const api = simulated();
      await expect(api.getRankingHeroDetail("does-not-exist")).rejects.toBeInstanceOf(
        GatewayError,
      );
      await expect(api.getRankingHeroFacts("does-not-exist")).rejects.toBeInstanceOf(
        GatewayError,
      );
    });

    it("CA4 (edge): an aborted request rejects and never resolves data", async () => {
      const api = createSimulatedLeaderboardApi({ delayMs: 50 });
      const controller = new AbortController();
      const pending = api.getRanking(query(), controller.signal);
      controller.abort();
      await expect(pending).rejects.toBeDefined();
    });
  });

  // ================================================================== CA5
  describe("CA5 — simulated data: my 3 heroes, deleted players, deltas, pending", () => {
    it("CA5: the current player owns a Warrior #7, a Shaman #58 and a Mage #210", async () => {
      const response = await simulated().getRanking(query());
      const mine = [...response.me].sort((a, b) => a.rank - b.rank);
      expect(mine.map((e) => [e.heroClass, e.rank])).toEqual([
        [HeroClass.WARRIOR, 7],
        [HeroClass.SHAMAN, 58],
        [HeroClass.MAGE, 210],
      ]);
      expect(mine.every((e) => e.playerId === ME)).toBe(true);
    });

    it("CA5: the Mage is absent from the season", async () => {
      const api = simulated();
      const season = await api.getRanking(query({ period: RankingPeriod.SEASON }));
      expect(season.me.map((e) => e.heroClass).sort()).toEqual(
        [HeroClass.SHAMAN, HeroClass.WARRIOR].sort(),
      );
      const { entries } = await allPages(api, { period: RankingPeriod.SEASON });
      expect(
        entries.some((e) => e.playerId === ME && e.heroClass === HeroClass.MAGE),
      ).toBe(false);
    });

    it("CA5: the population is deterministic and about 120 heroes in the season", async () => {
      const a = await allPages(simulated(), { period: RankingPeriod.SEASON });
      const b = await allPages(simulated(), { period: RankingPeriod.SEASON });
      expect(a.entries).toEqual(b.entries);
      expect(a.first.totalCount).toBeGreaterThanOrEqual(100);
      expect(a.first.totalCount).toBeLessThanOrEqual(140);
    });

    it("CA5: at least 2 heroes of deleted players (playerName and playerId null)", async () => {
      const { entries } = await allPages(simulated());
      const deleted = entries.filter((e) => e.playerName === null);
      expect(deleted.length).toBeGreaterThanOrEqual(2);
      expect(deleted.every((e) => e.playerId === null)).toBe(true);
    });

    it("CA5: rankDelta null and non-null (up, down, stable) are present", async () => {
      const { entries } = await allPages(simulated());
      const deltas = entries.map((e) => e.rankDelta);
      expect(deltas).toContain(null);
      expect(deltas.some((d) => d !== null && d > 0)).toBe(true);
      expect(deltas.some((d) => d !== null && d < 0)).toBe(true);
      expect(deltas.some((d) => d === 0)).toBe(true);
    });

    it("CA5: some lines are isPending in the default scenario", async () => {
      const { entries } = await allPages(simulated());
      const pending = entries.filter((e) => e.isPending);
      expect(pending.length).toBeGreaterThan(0);
      expect(pending.length).toBeLessThan(entries.length);
    });

    it("CA5 (edge): every entry respects the contract's value ranges", async () => {
      const { entries } = await allPages(simulated());
      for (const e of entries) {
        expect(e.winRate).toBeGreaterThanOrEqual(0);
        expect(e.winRate).toBeLessThanOrEqual(1);
        expect(Object.values(HeroClass)).toContain(e.heroClass);
        expect(Number.isInteger(e.rank) && e.rank >= 1).toBe(true);
        if (e.lastActivityAt !== null) {
          expect(Number.isNaN(Date.parse(e.lastActivityAt))).toBe(false);
        }
      }
      expect(new Set(entries.map((e) => e.heroId)).size).toBe(entries.length);
    });
  });

  // ================================================================== CA6
  describe("CA6 — pure rules of leaderboardRules.ts", () => {
    it("CA6: formatRankDelta gives ▲ n, ▼ n, — 0 and NEW with distinct directions", () => {
      const up = formatRankDelta(3);
      const down = formatRankDelta(-2);
      const stable = formatRankDelta(0);
      const fresh = formatRankDelta(null);
      expect(up.label).toBe("▲ 3");
      expect(down.label).toBe("▼ 2");
      expect(stable.label).toBe("— 0");
      expect(fresh.label).toBe("NEW");
      expect(
        new Set([up.direction, down.direction, stable.direction, fresh.direction]).size,
      ).toBe(4);
      expect(formatRankDelta(12).direction).toBe(up.direction);
      expect(formatRankDelta(-40).direction).toBe(down.direction);
    });

    it("CA6: podiumMedal gives gold, silver, bronze, then null", () => {
      expect(podiumMedal(1)).toBe("gold");
      expect(podiumMedal(2)).toBe("silver");
      expect(podiumMedal(3)).toBe("bronze");
      expect(podiumMedal(4)).toBeNull();
      expect(podiumMedal(0)).toBeNull();
      expect(podiumMedal(-1)).toBeNull();
      expect(podiumMedal(1.5)).toBeNull();
    });

    it("CA6: positionsBetween counts the ranks strictly between", () => {
      expect(positionsBetween(10, 58)).toBe(47);
      expect(positionsBetween(10, 11)).toBe(0);
      expect(positionsBetween(10, 12)).toBe(1);
      expect(positionsBetween(10, 5)).toBeGreaterThanOrEqual(0);
      expect(positionsBetween(10, 10)).toBe(0);
    });

    it("CA6: formatWinRate gives a whole percentage", () => {
      expect(formatWinRate(0.43)).toBe("43%");
      expect(formatWinRate(0)).toBe("0%");
      expect(formatWinRate(1)).toBe("100%");
      expect(formatWinRate(0.666)).toBe("67%");
    });

    it("CA6: formatRelativeTime gives seconds and minutes", () => {
      const now = new Date("2026-10-21T12:00:00Z");
      expect(formatRelativeTime("2026-10-21T11:59:48Z", now)).toBe("12 seconds ago");
      expect(formatRelativeTime("2026-10-21T11:57:00Z", now)).toBe("3 min ago");
      expect(typeof formatRelativeTime("2026-10-18T12:00:00Z", now)).toBe("string");
      expect(formatRelativeTime("2026-10-18T12:00:00Z", now)).not.toBe("");
    });

    it("CA6 (edge): formatRelativeTime survives invalid or future dates", () => {
      const now = new Date("2026-10-21T12:00:00Z");
      expect(() => formatRelativeTime("not a date", now)).not.toThrow();
      expect(formatRelativeTime("not a date", now)).not.toMatch(/NaN/);
      expect(formatRelativeTime("2026-10-21T12:05:00Z", now)).not.toMatch(/-|NaN/);
    });

    it("CA6: displayPlayerName falls back to Anonymous hero", () => {
      expect(displayPlayerName({ playerName: null })).toBe("Anonymous hero");
      expect(displayPlayerName({ playerName: "MaelisRune" })).toBe("MaelisRune");
    });

    it("CA6: labels cover every enum value", () => {
      expect(HERO_CLASS_LABELS).toEqual({
        [HeroClass.WARRIOR]: "Warrior",
        [HeroClass.SHAMAN]: "Shaman",
        [HeroClass.MAGE]: "Mage",
      });
      for (const value of Object.values(RankingPeriod)) {
        expect(RANKING_PERIOD_LABELS[value]).toMatch(/\S/);
      }
      for (const value of Object.values(RankingSort)) {
        expect(RANKING_SORT_LABELS[value]).toMatch(/\S/);
      }
      expect(RANKING_SORT_LABELS[RankingSort.TOTAL_XP]).toBe("Total XP");
    });

    it("CA6: parseRankingQuery reads valid values from the URL", () => {
      const state = parseRankingQuery({
        class: "mage",
        period: "week",
        search: "Mae",
        sort: "level",
        page: "4",
      });
      expect(state).toMatchObject({
        heroClass: HeroClass.MAGE,
        period: RankingPeriod.WEEK,
        search: "Mae",
        sort: RankingSort.LEVEL,
        page: 4,
        pageSize: 10,
      });
    });

    it("CA6: parseRankingQuery without parameters gives the defaults", () => {
      expect(parseRankingQuery({})).toMatchObject({
        heroClass: null,
        period: RankingPeriod.ALL_TIME,
        search: "",
        sort: RankingSort.TOTAL_XP,
        page: 1,
        pageSize: 10,
      });
    });

    it.each([
      [
        "unknown values",
        { class: "paladin", period: "decade", sort: "random", page: "x" },
      ],
      ["negative page", { page: "-3" }],
      ["page zero", { page: "0" }],
      ["decimal page", { page: "2.5" }],
      ["empty strings", { class: "", period: "", sort: "", page: "" }],
      [
        "non-string values",
        { class: 42, period: {}, sort: null, page: true, search: 7 },
      ],
      ["arrays of invalid", { class: ["x"], period: ["y"], page: ["-1"] }],
      ["huge page", { page: "1e309" }],
    ])("CA6: parseRankingQuery brings %s back to the defaults", (_label, raw) => {
      const state = parseRankingQuery(raw as Record<string, unknown>);
      expect(state.heroClass).toBeNull();
      expect(state.period).toBe(RankingPeriod.ALL_TIME);
      expect(state.sort).toBe(RankingSort.TOTAL_XP);
      expect(state.page).toBe(1);
      expect(state.pageSize).toBe(10);
      expect(typeof state.search).toBe("string");
    });

    it("CA6 (edge): parseRankingQuery ignores mock and survives null", () => {
      expect(() =>
        parseRankingQuery(null as unknown as Record<string, unknown>),
      ).not.toThrow();
      const state = parseRankingQuery({ mock: "error" });
      expect(state).not.toHaveProperty("mock");
    });

    it("CA6: toRouteQuery and parseRankingQuery round-trip", () => {
      const states: RankingQuery[] = [
        query(),
        query({
          heroClass: HeroClass.SHAMAN,
          period: RankingPeriod.SEASON,
          search: "storm",
          sort: RankingSort.LAST_ACTIVITY,
          page: 3,
        }),
      ];
      for (const state of states) {
        const routeQuery = toRouteQuery(state);
        for (const value of Object.values(routeQuery)) {
          expect(typeof value).toBe("string");
        }
        const { playerId: _playerId, ...urlState } = state;
        expect(parseRankingQuery(routeQuery)).toEqual(urlState);
      }
    });

    it("CA6 (edge): toRouteQuery leaves out the defaults (null class, empty search)", () => {
      const routeQuery = toRouteQuery(query());
      expect(routeQuery).not.toHaveProperty("class");
      expect(routeQuery).not.toHaveProperty("search");
    });

    it("CA6: the rules spec covers every listed rule", () => {
      const spec = readFileSync(
        join(FEATURE_DIR, "tests/leaderboardRules.spec.ts"),
        "utf8",
      );
      for (const name of [
        "formatRankDelta",
        "podiumMedal",
        "positionsBetween",
        "formatWinRate",
        "formatRelativeTime",
        "displayPlayerName",
        "parseRankingQuery",
        "toRouteQuery",
        "HERO_CLASS_LABELS",
        "RANKING_PERIOD_LABELS",
        "RANKING_SORT_LABELS",
      ]) {
        expect(spec, name).toContain(name);
      }
    });
  });

  // ================================================================== CA7
  describe("CA7 — RankingRowDetail.vue placeholder with the contract props", () => {
    it("CA7: takes heroId and currentPlayerId, declares no emit", () => {
      const component = RankingRowDetail as unknown as {
        props?: Record<string, { required?: boolean }>;
        emits?: unknown;
      };
      expect(Object.keys(component.props ?? {}).sort()).toEqual(
        ["currentPlayerId", "heroId"].sort(),
      );
      expect(component.props!.heroId!.required).toBe(true);
      expect(component.props!.currentPlayerId!.required).toBe(true);
      const emits = component.emits;
      expect(
        emits === undefined ||
          (Array.isArray(emits)
            ? emits.length === 0
            : Object.keys(emits as object).length === 0),
      ).toBe(true);
    });

    it("CA7: renders a simple « Loading hero detail… » paragraph", () => {
      const wrapper = mount(RankingRowDetail, {
        props: { heroId: "simulated-hero-007", currentPlayerId: ME },
      });
      expect(wrapper.get("p").text()).toBe("Loading hero detail…");
      expect(wrapper.emitted()).toEqual({});
    });
  });

  // ================================================================== CA8
  describe("CA8 — /leaderboard keeps working on the new contract", () => {
    it("CA8: the page asks for the first page with the default query for me", async () => {
      const api = simulated();
      const spy = vi.spyOn(api, "getRanking");
      mountPage(LeaderboardPage, api);
      await new Promise((resolve) => setTimeout(resolve, 1));
      await flushPromises();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]![0]).toEqual(query());
    });

    it("CA8: the page shows the first page with Rank, Hero and Total XP", async () => {
      vi.useFakeTimers();
      const wrapper = mountPage(LeaderboardPage);
      await elapse(400);

      expect(wrapper.findAll("h1")).toHaveLength(1);
      const headers = wrapper.findAll("thead th").map((th) => th.text());
      expect(headers).toEqual(expect.arrayContaining(["Rank", "Hero", "Total XP"]));
      for (const th of wrapper.findAll("thead th")) {
        expect(th.attributes("scope")).toBe("col");
      }
      const rows = wrapper.findAll("tbody tr");
      expect(rows).toHaveLength(10);
      expect(rows.map((row) => Number(row.findAll("td, th")[0]!.text()))).toEqual(
        Array.from({ length: 10 }, (_, i) => i + 1),
      );
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    });

    it("CA8: my Warrior #7 is marked by a « You » badge, not colour only", async () => {
      vi.useFakeTimers();
      const wrapper = mountPage(LeaderboardPage);
      await elapse(400);

      const mine = wrapper.findAll('tbody tr[aria-current="true"]');
      expect(mine).toHaveLength(1);
      expect(mine[0]!.text()).toContain("You");
      expect(mine[0]!.findAll("td, th")[0]!.text()).toBe("7");
    });

    it("CA8: Total XP shows the entry's totalXp and Hero its hero name", async () => {
      const api = simulated();
      const expected = await api.getRanking(query());
      const wrapper = mountPage(LeaderboardPage, api);
      await new Promise((resolve) => setTimeout(resolve, 1));
      await flushPromises();

      const headers = wrapper.findAll("thead th").map((th) => th.text());
      const heroCol = headers.indexOf("Hero");
      const xpCol = headers.indexOf("Total XP");
      const first = wrapper.findAll("tbody tr")[0]!.findAll("td, th");
      expect(first[heroCol]!.text()).toContain(expected.entries[0]!.heroName);
      expect(first[xpCol]!.text().replace(/\D/g, "")).toBe(
        String(expected.entries[0]!.totalXp),
      );
    });

    it("CA8 (edge): Refresh reads the ranking again; Retry recovers from an error", async () => {
      const api = simulated();
      const spy = vi
        .spyOn(api, "getRanking")
        .mockRejectedValueOnce(new GatewayError(503, { code: "X", message: "down" }));
      const wrapper = mountPage(LeaderboardPage, api);
      await new Promise((resolve) => setTimeout(resolve, 1));
      await flushPromises();
      expect(wrapper.find('[role="alert"]').exists()).toBe(true);

      await wrapper
        .findAll("button")
        .find((b) => b.text() === "Retry")!
        .trigger("click");
      await new Promise((resolve) => setTimeout(resolve, 1));
      await flushPromises();
      expect(wrapper.findAll("tbody tr")).toHaveLength(10);

      await wrapper
        .findAll("button")
        .find((b) => b.text() === "Refresh view")!
        .trigger("click");
      await new Promise((resolve) => setTimeout(resolve, 1));
      await flushPromises();
      expect(spy).toHaveBeenCalledTimes(3);
      expect(wrapper.findAll("tbody tr")).toHaveLength(10);
    });

    it("CA8 (edge): a deleted player's hero still renders its row", async () => {
      const api = simulated();
      const { entries } = await allPages(api);
      const deleted = entries.find((e) => e.playerName === null)!;
      const page = Math.ceil(deleted.rank / 10);
      vi.spyOn(api, "getRanking").mockImplementation((q) =>
        simulated().getRanking({ ...q, page }),
      );
      const wrapper = mountPage(LeaderboardPage, api);
      await new Promise((resolve) => setTimeout(resolve, 1));
      await flushPromises();
      expect(wrapper.text()).toContain(deleted.heroName);
      expect(wrapper.text()).not.toMatch(/null|undefined/);
    });

    it("CA8: no component or page imports mocks/ (everything goes through the API)", () => {
      const files = [
        ...walk(join(FEATURE_DIR, "components")),
        ...walk(join(FEATURE_DIR, "composables")),
        join(ROOT, "app/pages/leaderboard.vue"),
      ];
      for (const file of files) {
        expect(readFileSync(file, "utf8"), relative(ROOT, file)).not.toMatch(
          /from\s+["'][^"']*mocks\//,
        );
      }
    });
  });

  // ================================================================== CA9
  describe("CA9 — lint, typecheck and unit tests pass", () => {
    it("CA9: no new npm dependency for this feature", () => {
      const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
        dependencies?: Record<string, string>;
      };
      // The sheet forbids new dependencies; the ranking code imports only vue,
      // the shared layer and the feature itself.
      const sources = walk(FEATURE_DIR).filter(
        (file) => /\.(ts|vue)$/.test(file) && !file.includes("/tests/"),
      );
      for (const file of sources) {
        const imports = [
          ...readFileSync(file, "utf8").matchAll(/from\s+["']([^"']+)["']/g),
        ].map((m) => m[1]!);
        for (const spec of imports) {
          const external = !spec.startsWith(".") && !spec.startsWith("~");
          if (external)
            expect(["vue"], `${relative(ROOT, file)}: ${spec}`).toContain(spec);
        }
      }
      expect(pkg).toBeDefined();
    });
  });
});
