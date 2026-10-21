/**
 * F01 — Statistiques cumulées du héros et classement (données simulées).
 * Acceptance tests written from the feature sheet's criteria (CA1–CA13).
 * F00 moved the leaderboard to the hero ranking contract (D8): CA7, CA8, CA10,
 * CA12 and CA13 were adapted, CA9 (pinned line outside the top 50) retired;
 * CA1–CA6 are unchanged:
 * pages are mounted as the user reaches them, the API is stubbed at its
 * typed boundary (or the real simulated source is used for CA12).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import { LEADERBOARD_API_KEY, LEADERBOARD_SOURCE } from "../api/leaderboardSource";
import { STATISTICS_CATALOGUE } from "../statisticsCatalogue";
import {
  HeroClass,
  RankingPeriod,
  RankingSort,
  RankingStatus,
  StatisticCategory,
  type HeroStatisticsResponse,
  type LeaderboardApi,
  type RankingEntry,
  type RankingResponse,
} from "../types";
import { GatewayError } from "~/shared/utils/gateway";
import UiTopNavigation from "~/shared/ui/UiTopNavigation.vue";
import LeaderboardPage from "~/pages/leaderboard.vue";
import StatisticsPage from "~/pages/players/[playerId]/heroes/[heroId]/statistics.vue";
import HeroPage from "~/pages/players/[playerId]/heroes/[heroId]/index.vue";
import DefaultLayout from "~/layouts/default.vue";
import { SEEDED_PLAYER_ID } from "~/features/player/seededPlayer";

const playerApiMock = vi.hoisted(() => ({
  getHeroSheet: vi.fn(),
  listHeroes: vi.fn(),
  listHeroClasses: vi.fn(),
  selectHero: vi.fn(),
  deselectHero: vi.fn(),
  deleteHero: vi.fn(),
}));

vi.mock("~/features/player/api/playerApi", () => ({
  usePlayerApi: () => playerApiMock,
  createPlayerApi: () => playerApiMock,
}));

const ROOT = join(__dirname, "../../../..");
const FEATURE_DIR = join(ROOT, "app/features/leaderboard");

const PLAYER = "player-1";
const HERO = "hero-1";
const CATEGORY_LABELS: Record<StatisticCategory, string> = {
  [StatisticCategory.GAMES]: "Games",
  [StatisticCategory.DUNGEON]: "Dungeon",
  [StatisticCategory.COMBAT]: "Combat",
  [StatisticCategory.REWARDS]: "Rewards",
};

const stubs = {
  NuxtLink: { props: ["to"], template: '<a :href="to"><slot /></a>' },
  UiIconButton: true,
};

// ---------------------------------------------------------------- helpers

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function statsResponse(
  overrides: Partial<HeroStatisticsResponse> = {},
): HeroStatisticsResponse {
  return {
    heroId: HERO,
    consolidatedAt: minutesAgo(3),
    isConsolidating: false,
    statistics: STATISTICS_CATALOGUE.map((definition, index) => ({
      key: definition.key,
      value: 100 + index,
    })),
    ...overrides,
  };
}

// F00: the ranking helpers follow the hero ranking contract (D8).
function entry(
  rank: number,
  playerId: string | null = `p-${rank}`,
  totalXp = 100_000 - rank * 10,
): RankingEntry {
  return {
    rank,
    rankDelta: 0,
    heroId: `hero-${rank}`,
    heroName: `Hero ${rank}`,
    heroClass: HeroClass.WARRIOR,
    level: 10,
    totalXp,
    runs: 12,
    winRate: 0.5,
    lastActivityAt: minutesAgo(10),
    playerId,
    playerName: `Player ${rank}`,
    isPending: false,
  };
}

function board(overrides: Partial<RankingResponse> = {}): RankingResponse {
  return {
    consolidatedAt: minutesAgo(3),
    status: RankingStatus.LIVE,
    statusDetail: {
      lagSeconds: null,
      pendingCount: null,
      correctUpTo: null,
      rebuildProgress: null,
      snapshotAt: null,
      frozenAt: null,
      reason: null,
    },
    season: {
      id: "season-3",
      label: "Season 3",
      openedAt: "2026-09-21T00:00:00Z",
      previousSeasonId: "season-2",
    },
    page: 1,
    pageSize: 10,
    totalCount: 50,
    entries: Array.from({ length: 10 }, (_, index) => entry(index + 1)),
    me: [],
    ...overrides,
  };
}

function apiStub(
  partial: Partial<Record<keyof LeaderboardApi, ReturnType<typeof vi.fn>>> = {},
) {
  return {
    getHeroStatistics: vi.fn().mockResolvedValue(statsResponse()),
    getRanking: vi.fn().mockResolvedValue(board()),
    getRankingHeroDetail: vi.fn().mockRejectedValue(new Error("not used")),
    getRankingHeroFacts: vi.fn().mockRejectedValue(new Error("not used")),
    getPublicRanking: vi.fn().mockRejectedValue(new Error("not used")),
    ...partial,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let route: { params: Record<string, string>; query: Record<string, unknown> };

function mountPage(page: Component, api?: LeaderboardApi, attach = false) {
  return mount(page, {
    attachTo: attach ? document.body : undefined,
    global: {
      stubs,
      provide: api ? { [LEADERBOARD_API_KEY as symbol]: api } : {},
    },
  });
}

/** label → displayed value for every UiStat card inside `root`. */
function cards(root: { element: Element }): Record<string, string> {
  return Object.fromEntries(
    [...root.element.querySelectorAll(".ui-stat")].map((card) => [
      card.querySelector(".ui-stat__label")?.textContent?.trim() ?? "",
      card.querySelector(".ui-stat__value")?.textContent?.trim() ?? "",
    ]),
  );
}

function section(wrapper: VueWrapper, title: string) {
  const heading = wrapper.findAll("h2").find((h) => h.text() === title);
  expect(heading, `section "${title}"`).toBeDefined();
  return heading!.element.closest("section, [role='region'], div")!;
}

function button(wrapper: VueWrapper, label: RegExp) {
  return wrapper.findAll("button").find((b) => label.test(b.text()));
}

/** A visible element whose whole text is "You" (badge), not colour only. */
function youBadge(root: { element: Element }): Element | undefined {
  return [...root.element.querySelectorAll("*")].find(
    (el) =>
      el.textContent?.trim() === "You" &&
      el.closest("[aria-hidden='true'], .visually-hidden") === null,
  );
}

function liveRegion(wrapper: VueWrapper) {
  return wrapper.find('[aria-live="polite"]');
}

/** The live region must stay in the DOM and be exposed (never display:none). */
function expectExposedLiveRegion(wrapper: VueWrapper) {
  const regions = wrapper.findAll('[aria-live="polite"]');
  expect(regions, "exactly one polite live region").toHaveLength(1);
  const el = regions[0]!.element as HTMLElement;
  expect(el.style.display).not.toBe("none");
  expect(el.hidden).toBe(false);
  expect(el.closest("[aria-hidden='true'], [hidden]")).toBeNull();
  return el;
}

/** Visible text of the alert, minus its title: the explicit reason. */
function alertText(wrapper: VueWrapper): string {
  return wrapper.get('[role="alert"]').text().replace(/\s+/g, " ").trim();
}

const BLANK_ERRORS: Array<[string, unknown]> = [
  ["empty message", new GatewayError(500, { code: "X", message: "" })],
  ["whitespace-only message", new GatewayError(502, { code: "X", message: "  \n\t " })],
  [
    "missing message",
    new GatewayError(500, { code: "X" } as unknown as {
      code: string;
      message: string;
    }),
  ],
  [
    "status 0 (network) without message",
    new GatewayError(0, { code: "", message: "" }),
  ],
  ["rejection with undefined", undefined],
  ["rejection with a bare string", "boom"],
  ["Error with empty message", new Error("")],
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

beforeEach(() => {
  route = reactive({ params: { playerId: PLAYER, heroId: HERO }, query: {} });
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

describe("F01", () => {
  // ============================================================ statistics page
  describe("CA1 — every catalogue statistic, with label and cumulated value, by category", () => {
    it("CA1: the catalogue has ~15 keys spread over Games, Dungeon, Combat, Rewards", () => {
      expect(STATISTICS_CATALOGUE.length).toBeGreaterThanOrEqual(12);
      expect(STATISTICS_CATALOGUE.length).toBeLessThanOrEqual(20);
      expect(new Set(STATISTICS_CATALOGUE.map((s) => s.category))).toEqual(
        new Set(Object.values(StatisticCategory)),
      );
      expect(new Set(STATISTICS_CATALOGUE.map((s) => s.key)).size).toBe(
        STATISTICS_CATALOGUE.length,
      );
    });

    it("CA1: shows each statistic's label and value inside its category section", async () => {
      const api = apiStub();
      const wrapper = mountPage(StatisticsPage, api);
      await flushPromises();

      expect(api.getHeroStatistics).toHaveBeenCalledWith(
        PLAYER,
        HERO,
        expect.anything(),
      );
      expect(wrapper.findAll(".ui-stat")).toHaveLength(STATISTICS_CATALOGUE.length);

      STATISTICS_CATALOGUE.forEach((definition, index) => {
        const sectionEl = section(wrapper, CATEGORY_LABELS[definition.category]);
        const sectionCards = Object.fromEntries(
          [...sectionEl.querySelectorAll(".ui-stat")].map((card) => [
            card.querySelector(".ui-stat__label")!.textContent!.trim(),
            card.querySelector(".ui-stat__value")!.textContent!.trim(),
          ]),
        );
        expect(sectionCards[definition.label], definition.key).toBe(
          String(100 + index),
        );
      });
    });

    it("CA1: large cumulated values are shown in full (not truncated)", async () => {
      const api = apiStub({
        getHeroStatistics: vi.fn().mockResolvedValue(
          statsResponse({
            statistics: [{ key: STATISTICS_CATALOGUE[0]!.key, value: 1_234_567 }],
          }),
        ),
      });
      const wrapper = mountPage(StatisticsPage, api);
      await flushPromises();

      expect(cards(wrapper)[STATISTICS_CATALOGUE[0]!.label]!.replace(/\D/g, "")).toBe(
        "1234567",
      );
    });

    it("CA1: keys unknown to the catalogue are not displayed", async () => {
      const api = apiStub({
        getHeroStatistics: vi.fn().mockResolvedValue(
          statsResponse({
            statistics: [
              ...statsResponse().statistics,
              { key: "unknown_key", value: 9 },
            ],
          }),
        ),
      });
      const wrapper = mountPage(StatisticsPage, api);
      await flushPromises();

      expect(wrapper.findAll(".ui-stat")).toHaveLength(STATISTICS_CATALOGUE.length);
      expect(wrapper.text()).not.toContain("unknown_key");
    });
  });

  describe("CA2 — re-read on every visit, consolidation date displayed", () => {
    it('CA2: shows the age of the last consolidation ("Updated 3 min ago")', async () => {
      const wrapper = mountPage(StatisticsPage, apiStub());
      await flushPromises();

      expect(wrapper.text()).toContain("Updated 3 min ago");
    });

    it("CA2: opening the page again reads again and shows the fresh figures", async () => {
      const key = STATISTICS_CATALOGUE[0]!;
      const api = apiStub({
        getHeroStatistics: vi
          .fn()
          .mockResolvedValueOnce(
            statsResponse({ statistics: [{ key: key.key, value: 1 }] }),
          )
          .mockResolvedValueOnce(
            statsResponse({ statistics: [{ key: key.key, value: 2 }] }),
          ),
      });

      const first = mountPage(StatisticsPage, api);
      await flushPromises();
      expect(cards(first)[key.label]).toBe("1");
      first.unmount();

      const second = mountPage(StatisticsPage, api);
      await flushPromises();
      expect(api.getHeroStatistics).toHaveBeenCalledTimes(2);
      expect(cards(second)[key.label]).toBe("2");
    });

    it("CA2: moving to another hero re-reads that hero's statistics", async () => {
      const api = apiStub();
      mountPage(StatisticsPage, api);
      await flushPromises();

      route.params.heroId = "hero-2";
      await flushPromises();

      expect(api.getHeroStatistics).toHaveBeenLastCalledWith(
        PLAYER,
        "hero-2",
        expect.anything(),
      );
    });

    it("CA2: the feature keeps no client cache (no useFetch/useAsyncData/useState/storage)", () => {
      // F04 (decision D11): the public, server-rendered rankings read through
      // `useAsyncData` by design (payload hydration, no client cache).
      const sources = walk(FEATURE_DIR)
        .filter((file) => !file.includes("/tests/") && /\.(ts|vue)$/.test(file))
        .filter((file) => !file.endsWith("/composables/usePublicRanking.ts"))
        .map((file) => readFileSync(file, "utf8"));
      for (const source of sources) {
        expect(source).not.toMatch(
          /useAsyncData|useFetch|useState\(|localStorage|sessionStorage/,
        );
      }
    });
  });

  describe("CA3 — hero who never played: zeros, no error, no empty screen", () => {
    const emptyResponses: [string, unknown][] = [
      ["empty statistics", statsResponse({ statistics: [], consolidatedAt: null })],
      [
        "missing keys",
        statsResponse({
          statistics: [{ key: STATISTICS_CATALOGUE[0]!.key, value: 4 }],
        }),
      ],
      [
        "no statistics field",
        { heroId: HERO, consolidatedAt: null, isConsolidating: false },
      ],
      ["null body", null],
    ];

    it.each(emptyResponses)(
      "CA3: %s → every catalogue statistic shows 0",
      async (_, response) => {
        const api = apiStub({ getHeroStatistics: vi.fn().mockResolvedValue(response) });
        const wrapper = mountPage(StatisticsPage, api);
        await flushPromises();

        expect(wrapper.find('[role="alert"]').exists()).toBe(false);
        const shown = cards(wrapper);
        expect(Object.keys(shown)).toHaveLength(STATISTICS_CATALOGUE.length);
        for (const definition of STATISTICS_CATALOGUE) {
          if (
            response &&
            definition.key === STATISTICS_CATALOGUE[0]!.key &&
            _ === "missing keys"
          ) {
            expect(shown[definition.label]).toBe("4");
          } else {
            expect(shown[definition.label], definition.key).toBe("0");
          }
        }
        expect(wrapper.findAll("h2").length).toBe(4);
      },
    );
  });

  describe("CA4 — consolidation in progress: figures shown, discreet mention", () => {
    it("CA4: shows the last consolidated figures with at most one non-blocking mention", async () => {
      const api = apiStub({
        getHeroStatistics: vi
          .fn()
          .mockResolvedValue(statsResponse({ isConsolidating: true })),
      });
      const wrapper = mountPage(StatisticsPage, api);
      await flushPromises();

      expect(wrapper.findAll(".ui-stat")).toHaveLength(STATISTICS_CATALOGUE.length);
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      expect(button(wrapper, /retry/i)).toBeUndefined();
      expect(wrapper.text()).toContain("Updated 3 min ago");
      const mentions = wrapper.text().match(/consolidat/gi) ?? [];
      expect(mentions.length).toBeGreaterThanOrEqual(1);
      expect(mentions.length).toBeLessThanOrEqual(1);
    });

    it("CA4: no mention when no consolidation is running", async () => {
      const wrapper = mountPage(StatisticsPage, apiStub());
      await flushPromises();

      expect(wrapper.text()).not.toMatch(/being consolidated/i);
    });
  });

  describe("CA5 — failure: explicit alert, Retry, loading announced", () => {
    it("CA5: loading is announced in an aria-live=polite region", async () => {
      const pending = deferred<HeroStatisticsResponse>();
      const api = apiStub({
        getHeroStatistics: vi.fn().mockReturnValue(pending.promise),
      });
      const wrapper = mountPage(StatisticsPage, api);
      await nextTick();

      expect(liveRegion(wrapper).exists()).toBe(true);
      expect(liveRegion(wrapper).text()).toMatch(/loading/i);
      pending.resolve(statsResponse());
      await flushPromises();
      expect(liveRegion(wrapper).text()).not.toMatch(/loading/i);
    });

    it("CA5: a failed call shows an explicit role=alert and Retry reloads successfully", async () => {
      const api = apiStub({
        getHeroStatistics: vi
          .fn()
          .mockRejectedValueOnce(
            new GatewayError(503, { code: "DOWN", message: "Service unavailable." }),
          )
          .mockResolvedValueOnce(statsResponse()),
      });
      const wrapper = mountPage(StatisticsPage, api);
      await flushPromises();

      const alert = wrapper.get('[role="alert"]');
      expect(alert.text()).toMatch(/could not be loaded|error|unavailable/i);
      expect(wrapper.findAll(".ui-stat")).toHaveLength(0);

      const retry = button(wrapper, /^retry$/i);
      expect(retry, "Retry button").toBeDefined();
      await retry!.trigger("click");
      await flushPromises();

      expect(api.getHeroStatistics).toHaveBeenCalledTimes(2);
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      expect(wrapper.findAll(".ui-stat")).toHaveLength(STATISTICS_CATALOGUE.length);
    });

    it("CA5: a network failure (non Gateway error) is explicit too", async () => {
      const api = apiStub({
        getHeroStatistics: vi.fn().mockRejectedValue(new TypeError("x")),
      });
      const wrapper = mountPage(StatisticsPage, api);
      await flushPromises();

      expect(wrapper.get('[role="alert"]').text().length).toBeGreaterThan(10);
      expect(button(wrapper, /^retry$/i)).toBeDefined();
    });

    it("CA5: a Gateway error without message still shows the alert and Retry", async () => {
      const api = apiStub({
        getHeroStatistics: vi
          .fn()
          .mockRejectedValue(new GatewayError(500, { code: "X", message: "" })),
      });
      const wrapper = mountPage(StatisticsPage, api);
      await flushPromises();

      expect(wrapper.find('[role="alert"]').exists()).toBe(true);
      expect(button(wrapper, /^retry$/i)).toBeDefined();
    });

    it("CA5: Retry announces loading again while the new read is pending", async () => {
      const pending = deferred<HeroStatisticsResponse>();
      const api = apiStub({
        getHeroStatistics: vi
          .fn()
          .mockRejectedValueOnce(new GatewayError(503, { code: "D", message: "Down." }))
          .mockReturnValueOnce(pending.promise),
      });
      const wrapper = mountPage(StatisticsPage, api);
      await flushPromises();

      await button(wrapper, /^retry$/i)!.trigger("click");
      await nextTick();
      expect(liveRegion(wrapper).text()).toMatch(/loading/i);
      pending.resolve(statsResponse());
      await flushPromises();
    });
  });

  describe("CA5 — edge cases (blank errors, live region always exposed)", () => {
    it.each(BLANK_ERRORS)(
      "CA5: %s → explicit role=alert with a readable reason, and Retry",
      async (_label, failure) => {
        const api = apiStub({ getHeroStatistics: vi.fn().mockRejectedValue(failure) });
        const wrapper = mountPage(StatisticsPage, api);
        await flushPromises();

        expect(wrapper.find('[role="alert"]').exists()).toBe(true);
        const text = alertText(wrapper);
        expect(text).toMatch(/could not be loaded/i);
        // the reason paragraph itself is not blank
        const reason = wrapper
          .get('[role="alert"]')
          .findAll("p")
          .map((p) => p.text());
        expect(reason.some((t) => t.trim().length > 10)).toBe(true);
        expect(text).not.toMatch(/undefined|null|\[object|boom|at \w+ \(/i);
        expect(button(wrapper, /^retry$/i)).toBeDefined();
      },
    );

    it("CA5: Retry after a whitespace-only error announces loading, then shows figures", async () => {
      const pending = deferred<HeroStatisticsResponse>();
      const api = apiStub({
        getHeroStatistics: vi
          .fn()
          .mockRejectedValueOnce(new GatewayError(500, { code: "X", message: "   " }))
          .mockReturnValueOnce(pending.promise),
      });
      const wrapper = mountPage(StatisticsPage, api);
      await flushPromises();
      const before = expectExposedLiveRegion(wrapper);

      await button(wrapper, /^retry$/i)!.trigger("click");
      await nextTick();
      const during = expectExposedLiveRegion(wrapper);
      expect(during).toBe(before); // same node, so the change is announced
      expect(during.textContent).toMatch(/loading/i);
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);

      pending.resolve(statsResponse());
      await flushPromises();
      expect(api.getHeroStatistics).toHaveBeenCalledTimes(2);
      expect(wrapper.findAll(".ui-stat")).toHaveLength(STATISTICS_CATALOGUE.length);
      expect(expectExposedLiveRegion(wrapper).textContent).not.toMatch(/loading/i);
    });

    it("CA5: the live region exists before, during and after loading (ready and error)", async () => {
      const pending = deferred<HeroStatisticsResponse>();
      const api = apiStub({
        getHeroStatistics: vi
          .fn()
          .mockReturnValueOnce(pending.promise)
          .mockRejectedValueOnce(new GatewayError(500, { code: "X", message: "" })),
      });
      const wrapper = mountPage(StatisticsPage, api);
      await nextTick();
      const node = expectExposedLiveRegion(wrapper);
      pending.resolve(statsResponse());
      await flushPromises();
      expect(expectExposedLiveRegion(wrapper)).toBe(node);

      route.params.heroId = "hero-2";
      await flushPromises();
      if (wrapper.find('[role="alert"]').exists()) {
        expect(expectExposedLiveRegion(wrapper)).toBeTruthy();
      }
    });

    it("CA5: the live region template has no v-if/v-show and is not display:none in CSS", () => {
      const source = readFileSync(
        join(FEATURE_DIR, "components/LeaderboardLoadState.vue"),
        "utf8",
      );
      const tag = source.match(/<[a-z]+[^>]*aria-live="polite"[^>]*>/s)?.[0] ?? "";
      expect(tag).not.toBe("");
      expect(tag).not.toMatch(/v-if|v-show|v-else|\s:?hidden[\s=>]/);
      const base = readFileSync(join(ROOT, "app/assets/styles/_base.scss"), "utf8");
      const vh = base.split(".visually-hidden")[1]?.split("}")[0] ?? "";
      expect(vh).not.toMatch(/display:\s*none|visibility:\s*hidden/);
    });
  });

  describe('CA6 — "View progression →" leads to this hero\'s statistics', () => {
    beforeEach(() => {
      playerApiMock.getHeroSheet.mockReset().mockImplementation(async (_p, heroId) => ({
        id: heroId,
        name: "Aria",
        classCode: "mage",
        level: 3,
        createdAt: "2026-01-01T00:00:00Z",
        attributes: { strength: 1, endurance: 2, agility: 3, intelligence: 4 },
        maximumHealth: 30,
        abilities: [],
      }));
      playerApiMock.listHeroes.mockReset().mockResolvedValue([]);
      playerApiMock.listHeroClasses.mockReset().mockResolvedValue([]);
    });

    function mountHeroPage() {
      return mount(HeroPage, {
        global: {
          stubs: {
            ...stubs,
            HeroSprite: true,
            HeroDeletionModal: true,
            UiNotice: { template: "<div><slot /></div>" },
            UiButton: { template: "<button><slot /></button>" },
            UiBadge: { template: "<span><slot /></span>" },
            UiPanel: { template: "<div><slot /></div>" },
            UiStat: true,
            UiProgressBar: true,
            UiIconButton: true,
          },
        },
      });
    }

    it("CA6: the link points to /players/{playerId}/heroes/{heroId}/statistics", async () => {
      const wrapper = mountHeroPage();
      await flushPromises();

      const link = wrapper
        .findAll("a")
        .find((a) => a.text().includes("View progression"));
      expect(link, "View progression link").toBeDefined();
      expect(link!.attributes("href")).toBe(
        `/players/${PLAYER}/heroes/${HERO}/statistics`,
      );
    });

    it("CA6: ids are URL-encoded in the link", async () => {
      route.params.playerId = "p/1";
      route.params.heroId = "h 2";
      const wrapper = mountHeroPage();
      await flushPromises();

      const link = wrapper
        .findAll("a")
        .find((a) => a.text().includes("View progression"));
      expect(link!.attributes("href")).toBe("/players/p%2F1/heroes/h%202/statistics");
    });

    it("CA6: the target route file exists", () => {
      expect(
        statSync(
          join(ROOT, "app/pages/players/[playerId]/heroes/[heroId]/statistics.vue"),
        ).isFile(),
      ).toBe(true);
    });
  });

  // ============================================================ leaderboard page
  // F00 (D8): the ranking is now one row per hero, paginated by 10. The top 50
  // by player, "Show my position" and the pinned line (old CA7–CA9) are
  // obsolete; F02 brings pagination, pinned heroes and "Jump to my rank".
  describe("CA7 — first page of the hero ranking in a semantic table, date and Refresh", () => {
    it("CA7: shows the page the API sends, in its order", async () => {
      const wrapper = mountPage(LeaderboardPage, apiStub());
      await flushPromises();

      const rows = wrapper.findAll("table tbody tr");
      expect(rows).toHaveLength(10);
      const ranks = rows.map((row) => Number(row.findAll("td, th")[0]!.text()));
      expect(ranks).toEqual(Array.from({ length: 10 }, (_, index) => index + 1));
    });

    it("CA7: the table is semantic with Rank, Hero and Total XP column headers", async () => {
      const wrapper = mountPage(LeaderboardPage, apiStub());
      await flushPromises();

      const headers = wrapper.findAll("table thead th");
      // F02 (CA2): the full set of columns.
      expect(headers.map((th) => th.text())).toEqual(
        expect.arrayContaining(["Rank", "Hero", "Total XP"]),
      );
      headers.forEach((th) => expect(th.attributes("scope")).toBe("col"));
      const first = wrapper.findAll("table tbody tr")[0]!;
      expect(first.text()).toContain("Hero 1");
      expect(first.text().replace(/\D/g, "")).toContain("99990");
    });

    it("CA7: shows the consolidation date", async () => {
      const wrapper = mountPage(LeaderboardPage, apiStub());
      await flushPromises();

      expect(wrapper.text()).toContain("Updated 3 min ago");
    });

    it("CA7: Refresh re-reads and displays the new ranking", async () => {
      const api = apiStub({
        getRanking: vi
          .fn()
          .mockResolvedValueOnce(board())
          .mockResolvedValueOnce(
            board({ entries: [{ ...entry(1), heroName: "NewLeader" }], totalCount: 1 }),
          ),
      });
      const wrapper = mountPage(LeaderboardPage, api);
      await flushPromises();

      const refresh = button(wrapper, /^refresh view$/i);
      expect(refresh, "Refresh button").toBeDefined();
      await refresh!.trigger("click");
      await flushPromises();

      expect(api.getRanking).toHaveBeenCalledTimes(2);
      expect(wrapper.findAll("table tbody tr")).toHaveLength(1);
      expect(wrapper.text()).toContain("NewLeader");
    });

    it("CA7: asks for the first page of the default ranking for the seeded player (D5)", async () => {
      const api = apiStub();
      mountPage(LeaderboardPage, api);
      await flushPromises();

      expect(api.getRanking).toHaveBeenCalledWith(
        {
          playerId: SEEDED_PLAYER_ID,
          heroClass: null,
          period: RankingPeriod.ALL_TIME,
          search: "",
          sort: RankingSort.TOTAL_XP,
          page: 1,
          pageSize: 10,
        },
        expect.anything(),
      );
    });
  });

  describe('CA8 — my heroes on the page: "You" badge and aria-current', () => {
    function boardWithMineAt(...ranks: number[]) {
      const entries = Array.from({ length: 10 }, (_, index) =>
        ranks.includes(index + 1)
          ? entry(index + 1, SEEDED_PLAYER_ID)
          : entry(index + 1),
      );
      return board({
        entries,
        me: entries.filter((e) => e.playerId === SEEDED_PLAYER_ID),
      });
    }

    // F02 (F00 hand-off): every hero of mine carries "You"; aria-current is kept
    // for the line "Jump to my rank" targets, my best-ranked hero (me[0]).
    it('CA8: my heroes carry a visible "You" badge; aria-current marks my best one', async () => {
      const api = apiStub({
        getRanking: vi.fn().mockResolvedValue(boardWithMineAt(3, 7)),
      });
      const wrapper = mountPage(LeaderboardPage, api);
      await flushPromises();

      const current = wrapper.findAll('tbody tr[aria-current="true"]');
      expect(current.map((row) => row.findAll("td, th")[0]!.text())).toEqual(["3"]);
      const mine = wrapper
        .findAll("tbody tr")
        .filter((row) => ["3", "7"].includes(row.findAll("td, th")[0]!.text()));
      for (const row of mine) expect(youBadge(row), "You badge").toBeDefined();
      const others = wrapper
        .findAll("tbody tr")
        .filter((row) => !["3", "7"].includes(row.findAll("td, th")[0]!.text()));
      expect(others).toHaveLength(8);
      expect(others.some((row) => youBadge(row) !== undefined)).toBe(false);
    });

    it("CA8: my hero is recognised by its playerId even when the API sends me=[]", async () => {
      const entries = Array.from({ length: 10 }, (_, index) =>
        index === 2 ? entry(3, SEEDED_PLAYER_ID) : entry(index + 1),
      );
      const api = apiStub({
        getRanking: vi.fn().mockResolvedValue(board({ entries })),
      });
      const wrapper = mountPage(LeaderboardPage, api);
      await flushPromises();

      expect(wrapper.get('tbody tr[aria-current="true"]').text()).toContain("Hero 3");
    });

    it("CA8: a deleted player's hero (playerId null) is never mine", async () => {
      const entries = [{ ...entry(1), playerId: null, playerName: null }];
      const api = apiStub({
        getRanking: vi.fn().mockResolvedValue(board({ entries, totalCount: 1 })),
      });
      const wrapper = mountPage(LeaderboardPage, api);
      await flushPromises();

      expect(wrapper.findAll("tbody tr")).toHaveLength(1);
      expect(wrapper.find('[aria-current="true"]').exists()).toBe(false);
    });
  });

  describe("CA10 — empty leaderboard and failure", () => {
    it("CA10: empty ranking → explicit message, no error, no table", async () => {
      const api = apiStub({
        getRanking: vi.fn().mockResolvedValue(board({ entries: [], totalCount: 0 })),
      });
      const wrapper = mountPage(LeaderboardPage, api);
      await flushPromises();

      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      expect(wrapper.find("table").exists()).toBe(false);
      expect(wrapper.text()).toMatch(/no hero|nobody|empty/i);
      expect(button(wrapper, /^refresh view$/i)).toBeDefined();
    });

    it("CA10: null body → treated as empty, not as an error", async () => {
      const api = apiStub({ getRanking: vi.fn().mockResolvedValue(null) });
      const wrapper = mountPage(LeaderboardPage, api);
      await flushPromises();

      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      expect(wrapper.text()).toMatch(/no hero|nobody|empty/i);
    });

    it("CA10: loading is announced (aria-live=polite)", async () => {
      const pending = deferred<RankingResponse>();
      const api = apiStub({ getRanking: vi.fn().mockReturnValue(pending.promise) });
      const wrapper = mountPage(LeaderboardPage, api);
      await nextTick();

      expect(liveRegion(wrapper).text()).toMatch(/loading/i);
      pending.resolve(board());
      await flushPromises();
      expect(liveRegion(wrapper).text()).not.toMatch(/loading/i);
    });

    it("CA10: failure → role=alert and Retry, which reloads the ranking", async () => {
      const api = apiStub({
        getRanking: vi
          .fn()
          .mockRejectedValueOnce(new GatewayError(503, { code: "D", message: "Down." }))
          .mockResolvedValueOnce(board()),
      });
      const wrapper = mountPage(LeaderboardPage, api);
      await flushPromises();

      expect(wrapper.get('[role="alert"]').text()).toMatch(
        /could not be loaded|error|down/i,
      );
      expect(wrapper.find("table").exists()).toBe(false);
      await button(wrapper, /^retry$/i)!.trigger("click");
      await flushPromises();

      expect(api.getRanking).toHaveBeenCalledTimes(2);
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      expect(wrapper.findAll("tbody tr")).toHaveLength(10);
    });

    it("CA10: a Gateway error without message still shows the alert and Retry", async () => {
      const api = apiStub({
        getRanking: vi
          .fn()
          .mockRejectedValue(new GatewayError(500, { code: "X", message: "" })),
      });
      const wrapper = mountPage(LeaderboardPage, api);
      await flushPromises();

      expect(wrapper.find('[role="alert"]').exists()).toBe(true);
      expect(button(wrapper, /^retry$/i)).toBeDefined();
    });

    it("CA10: a failing Refresh over displayed data shows the alert and Retry", async () => {
      const api = apiStub({
        getRanking: vi
          .fn()
          .mockResolvedValueOnce(board())
          .mockRejectedValueOnce(
            new GatewayError(503, { code: "D", message: "Down." }),
          ),
      });
      const wrapper = mountPage(LeaderboardPage, api);
      await flushPromises();
      await button(wrapper, /^refresh view$/i)!.trigger("click");
      await flushPromises();

      expect(wrapper.find('[role="alert"]').exists()).toBe(true);
      expect(button(wrapper, /^retry$/i)).toBeDefined();
    });
  });

  describe("CA10 — edge cases (blank errors, live region always exposed)", () => {
    it.each(BLANK_ERRORS)(
      "CA10: %s → explicit role=alert with a readable reason, and Retry",
      async (_label, failure) => {
        const api = apiStub({ getRanking: vi.fn().mockRejectedValue(failure) });
        const wrapper = mountPage(LeaderboardPage, api);
        await flushPromises();

        expect(wrapper.find('[role="alert"]').exists()).toBe(true);
        const text = alertText(wrapper);
        expect(text).toMatch(/could not be loaded/i);
        const reason = wrapper
          .get('[role="alert"]')
          .findAll("p")
          .map((p) => p.text());
        expect(reason.some((t) => t.trim().length > 10)).toBe(true);
        expect(text).not.toMatch(/undefined|null|\[object|boom|at \w+ \(/i);
        expect(wrapper.find("table").exists()).toBe(false);
        expect(button(wrapper, /^retry$/i)).toBeDefined();
      },
    );

    it("CA10: a failing Refresh with a blank message shows the alert and Retry", async () => {
      const api = apiStub({
        getRanking: vi
          .fn()
          .mockResolvedValueOnce(board())
          .mockRejectedValueOnce(new GatewayError(500, { code: "X", message: " " }))
          .mockResolvedValueOnce(board()),
      });
      const wrapper = mountPage(LeaderboardPage, api);
      await flushPromises();
      await button(wrapper, /^refresh view$/i)!.trigger("click");
      await flushPromises();

      expect(alertText(wrapper)).toMatch(/could not be loaded/i);
      await button(wrapper, /^retry$/i)!.trigger("click");
      await flushPromises();
      expect(api.getRanking).toHaveBeenCalledTimes(3);
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      expect(wrapper.findAll("tbody tr")).toHaveLength(10);
    });

    it("CA10: Retry after a whitespace-only error announces loading, then shows the ranking", async () => {
      const pending = deferred<RankingResponse>();
      const api = apiStub({
        getRanking: vi
          .fn()
          .mockRejectedValueOnce(new GatewayError(500, { code: "X", message: "\t" }))
          .mockReturnValueOnce(pending.promise),
      });
      const wrapper = mountPage(LeaderboardPage, api);
      await flushPromises();
      const before = expectExposedLiveRegion(wrapper);

      await button(wrapper, /^retry$/i)!.trigger("click");
      await nextTick();
      const during = expectExposedLiveRegion(wrapper);
      expect(during).toBe(before);
      expect(during.textContent).toMatch(/loading/i);

      pending.resolve(board());
      await flushPromises();
      expect(wrapper.findAll("tbody tr")).toHaveLength(10);
      expect(expectExposedLiveRegion(wrapper).textContent).not.toMatch(/loading/i);
    });

    it("CA10: the live region stays exposed in ready, empty and error states", async () => {
      const api = apiStub({
        getRanking: vi
          .fn()
          .mockResolvedValueOnce(board())
          .mockResolvedValueOnce(board({ entries: [], totalCount: 0, me: [] }))
          .mockRejectedValueOnce(new GatewayError(500, { code: "X", message: "" })),
      });
      const wrapper = mountPage(LeaderboardPage, api);
      await flushPromises();
      const node = expectExposedLiveRegion(wrapper);
      expect(node.textContent?.trim()).toBe("");

      await button(wrapper, /^refresh view$/i)!.trigger("click");
      await flushPromises();
      expect(wrapper.text()).toMatch(/no hero/i);
      expect(expectExposedLiveRegion(wrapper)).toBe(node);

      await button(wrapper, /^refresh view$/i)!.trigger("click");
      await flushPromises();
      expect(wrapper.find('[role="alert"]').exists()).toBe(true);
      expect(expectExposedLiveRegion(wrapper)).toBe(node);
    });
  });

  describe('CA11 — "Leaderboard" in the main navigation', () => {
    it("CA11: the default layout's main navigation links to /leaderboard", () => {
      const wrapper = mount(DefaultLayout, {
        global: { stubs, components: { UiTopNavigation } },
        slots: { default: "<p>page</p>" },
      });

      const nav = wrapper.get('nav[aria-label="Main navigation"]');
      const link = nav.findAll("a").find((a) => a.text() === "Leaderboard");
      expect(link, "Leaderboard link").toBeDefined();
      expect(link!.attributes("href")).toBe("/leaderboard");
    });
  });

  // ============================================================ transverse
  describe("CA12 — single source switch, ?mock= scenarios, ~300 ms delay", () => {
    function useFakeTimeouts() {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    }

    async function elapse(ms: number) {
      await vi.advanceTimersByTimeAsync(ms);
      await flushPromises();
    }

    it("CA12: the source is chosen in one place only (api/leaderboardSource.ts)", () => {
      expect(LEADERBOARD_SOURCE).toBeDefined();
      const offenders = walk(join(ROOT, "app"))
        .filter((file) => /\.(ts|vue)$/.test(file) && !file.includes("/tests/"))
        .filter((file) => {
          const source = readFileSync(file, "utf8");
          return /createSimulatedLeaderboardApi\(|createLeaderboardApi\(|LeaderboardSource\.(SIMULATED|GATEWAY)/.test(
            source,
          );
        })
        .map((file) => relative(ROOT, file))
        .filter(
          (file) =>
            ![
              "app/features/leaderboard/api/leaderboardSource.ts",
              "app/features/leaderboard/api/leaderboardApi.ts",
              "app/features/leaderboard/api/simulatedLeaderboardApi.ts",
            ].includes(file),
        );
      expect(offenders).toEqual([]);
    });

    it("CA12: no component, page, composable or layout imports the simulated data", () => {
      const offenders = walk(join(ROOT, "app"))
        .filter((file) => /\.(ts|vue)$/.test(file) && !file.includes("/tests/"))
        .filter((file) => /from\s+["'][^"']*mocks\//.test(readFileSync(file, "utf8")))
        .map((file) => relative(ROOT, file));
      expect(offenders).toEqual([
        "app/features/leaderboard/api/simulatedLeaderboardApi.ts",
      ]);
    });

    it("CA12: no ?mock= → played scenario, delivered after ~300 ms (loading before)", async () => {
      useFakeTimeouts();
      const wrapper = mountPage(StatisticsPage);
      await flushPromises();

      await elapse(299);
      expect(liveRegion(wrapper).text()).toMatch(/loading/i);
      expect(wrapper.findAll(".ui-stat")).toHaveLength(0);

      await elapse(1);
      expect(wrapper.findAll(".ui-stat")).toHaveLength(STATISTICS_CATALOGUE.length);
      expect(Object.values(cards(wrapper)).some((value) => value !== "0")).toBe(true);
    });

    it("CA12: ?mock=empty → zeros on the statistics page, empty message on the leaderboard", async () => {
      route.query = { mock: "empty" };
      useFakeTimeouts();
      const stats = mountPage(StatisticsPage);
      const ranking = mountPage(LeaderboardPage);
      await elapse(300);

      expect(Object.values(cards(stats)).every((value) => value === "0")).toBe(true);
      expect(stats.find('[role="alert"]').exists()).toBe(false);
      expect(ranking.find("table").exists()).toBe(false);
      expect(ranking.find('[role="alert"]').exists()).toBe(false);
    });

    it("CA12: ?mock=consolidating → discreet mention; the ranking still shows", async () => {
      route.query = { mock: "consolidating" };
      useFakeTimeouts();
      const stats = mountPage(StatisticsPage);
      const ranking = mountPage(LeaderboardPage);
      await elapse(300);

      expect(stats.text()).toMatch(/consolidat/i);
      expect(stats.find('[role="alert"]').exists()).toBe(false);
      // F00: no pinned line any more; the ranking is read as usual.
      expect(ranking.find('[role="alert"]').exists()).toBe(false);
      expect(ranking.findAll("tbody tr")).toHaveLength(10);
    });

    it("CA12: ?mock=error → alert and Retry on both pages", async () => {
      route.query = { mock: "error" };
      useFakeTimeouts();
      const stats = mountPage(StatisticsPage);
      const ranking = mountPage(LeaderboardPage);
      await elapse(300);

      for (const wrapper of [stats, ranking]) {
        expect(wrapper.find('[role="alert"]').exists()).toBe(true);
        expect(button(wrapper, /^retry$/i)).toBeDefined();
      }
    });

    it("CA12: ?mock=played → my line badged in the table", async () => {
      route.query = { mock: "played" };
      useFakeTimeouts();
      const ranking = mountPage(LeaderboardPage);
      await elapse(300);

      expect(ranking.findAll("tbody tr")).toHaveLength(10);
      expect(youBadge(ranking.get('tbody tr[aria-current="true"]'))).toBeDefined();
    });

    it("CA12: an unknown ?mock= value falls back to played", async () => {
      route.query = { mock: "<script>" };
      useFakeTimeouts();
      const ranking = mountPage(LeaderboardPage);
      await elapse(300);

      expect(ranking.find('[role="alert"]').exists()).toBe(false);
      expect(ranking.findAll("tbody tr")).toHaveLength(10);
    });
  });

  describe("CA13 — RGAA: one h1, role=list, focus visible, not colour only", () => {
    it("CA13: the statistics page has exactly one h1 in every state", async () => {
      const pending = deferred<HeroStatisticsResponse>();
      const loading = mountPage(
        StatisticsPage,
        apiStub({ getHeroStatistics: vi.fn().mockReturnValue(pending.promise) }),
      );
      await nextTick();
      expect(loading.findAll("h1")).toHaveLength(1);

      const ready = mountPage(StatisticsPage, apiStub());
      const failed = mountPage(
        StatisticsPage,
        apiStub({ getHeroStatistics: vi.fn().mockRejectedValue(new Error("x")) }),
      );
      await flushPromises();
      expect(ready.findAll("h1")).toHaveLength(1);
      expect(failed.findAll("h1")).toHaveLength(1);
    });

    it("CA13: the leaderboard page has exactly one h1 in every state", async () => {
      const ready = mountPage(LeaderboardPage, apiStub());
      const empty = mountPage(
        LeaderboardPage,
        apiStub({ getRanking: vi.fn().mockResolvedValue(board({ entries: [] })) }),
      );
      const failed = mountPage(
        LeaderboardPage,
        apiStub({ getRanking: vi.fn().mockRejectedValue(new Error("x")) }),
      );
      await flushPromises();
      for (const wrapper of [ready, empty, failed]) {
        expect(wrapper.findAll("h1")).toHaveLength(1);
      }
    });

    it("CA13: the layout adds no h1 of its own", () => {
      const wrapper = mount(DefaultLayout, {
        global: { stubs, components: { UiTopNavigation } },
        slots: { default: "<p>page</p>" },
      });
      expect(wrapper.findAll("h1")).toHaveLength(0);
    });

    it('CA13: every list on both pages carries role="list"', async () => {
      const me = [entry(87, SEEDED_PLAYER_ID)];
      const stats = mountPage(StatisticsPage, apiStub());
      const ranking = mountPage(
        LeaderboardPage,
        apiStub({ getRanking: vi.fn().mockResolvedValue(board({ me })) }),
      );
      await flushPromises();

      for (const wrapper of [stats, ranking]) {
        for (const list of wrapper.findAll("ul, ol")) {
          expect(list.attributes("role")).toBe("list");
        }
      }
      expect(stats.findAll('ul[role="list"], ol[role="list"]').length).toBeGreaterThan(
        0,
      );
    });

    it("CA13: my line is marked by text and aria-current, not only by colour", async () => {
      const entries = Array.from({ length: 10 }, (_, index) =>
        index === 0 ? entry(1, SEEDED_PLAYER_ID) : entry(index + 1),
      );
      const api = apiStub({
        getRanking: vi.fn().mockResolvedValue(board({ entries, me: [entries[0]!] })),
      });
      const wrapper = mountPage(LeaderboardPage, api);
      await flushPromises();

      const row = wrapper.get('tbody tr[aria-current="true"]');
      const badge = youBadge(row);
      expect(badge, '"You" text').toBeDefined();
      expect(badge!.closest("[aria-hidden='true'], .visually-hidden")).toBeNull();
    });

    it("CA13: focusable lines have a visible focus style; no hard-coded colours", () => {
      const files = walk(join(FEATURE_DIR, "components")).filter((file) =>
        file.endsWith(".vue"),
      );
      const table = readFileSync(
        join(FEATURE_DIR, "components/LeaderboardTable.vue"),
        "utf8",
      );
      expect(table).toMatch(/:focus(-visible)?[^{]*\{[^}]*outline:\s*(?!none)[^;]+;/);
      for (const file of files) {
        const style = readFileSync(file, "utf8").split("<style")[1] ?? "";
        expect(style, relative(ROOT, file)).not.toMatch(
          /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|--palette-/i,
        );
        expect(style, relative(ROOT, file)).not.toMatch(/outline:\s*(none|0)\b/);
      }
    });

    it("CA13: both routes are client-rendered and justified (D2, ADR-FE-003)", () => {
      const config = readFileSync(join(ROOT, "nuxt.config.ts"), "utf8");
      expect(config).toMatch(/["']\/leaderboard["']\s*:\s*\{\s*ssr:\s*false\s*\}/);
      expect(config).toMatch(
        /["']\/players\/\*\/heroes\/\*\/statistics["']\s*:\s*\{\s*ssr:\s*false\s*\}/,
      );
      const doc = readFileSync(join(ROOT, "docs/rendering-modes.md"), "utf8");
      expect(doc).toContain("`/leaderboard`");
      expect(doc).toContain("`/players/*/heroes/*/statistics`");
    });
  });
});
