/**
 * F01 — Statistiques cumulées du héros et classement (données simulées).
 * Acceptance tests written from the feature sheet's criteria (CA1–CA13):
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
  StatisticCategory,
  type HeroStatisticsResponse,
  type LeaderboardApi,
  type LeaderboardEntry,
  type LeaderboardResponse,
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

function entry(rank: number, playerId = `p-${rank}`, score = 100_000 - rank * 10) {
  return { rank, playerId, playerName: `Player ${rank}`, score } as LeaderboardEntry;
}

function board(overrides: Partial<LeaderboardResponse> = {}): LeaderboardResponse {
  return {
    consolidatedAt: minutesAgo(3),
    entries: Array.from({ length: 50 }, (_, index) => entry(index + 1)),
    me: null,
    ...overrides,
  };
}

function apiStub(
  partial: Partial<Record<keyof LeaderboardApi, ReturnType<typeof vi.fn>>> = {},
) {
  return {
    getHeroStatistics: vi.fn().mockResolvedValue(statsResponse()),
    getLeaderboard: vi.fn().mockResolvedValue(board()),
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
      const sources = walk(FEATURE_DIR)
        .filter((file) => !file.includes("/tests/") && /\.(ts|vue)$/.test(file))
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
  describe("CA7 — top 50 by ascending rank in a semantic table, date and Refresh", () => {
    it("CA7: keeps at most 50 players, sorted by ascending rank, even if the API sends more, unsorted", async () => {
      const entries = Array.from({ length: 60 }, (_, index) => entry(60 - index));
      const api = apiStub({
        getLeaderboard: vi.fn().mockResolvedValue(board({ entries })),
      });
      const wrapper = mountPage(LeaderboardPage, api);
      await flushPromises();

      const rows = wrapper.findAll("table tbody tr");
      expect(rows).toHaveLength(50);
      const ranks = rows.map((row) => Number(row.findAll("td, th")[0]!.text()));
      expect(ranks).toEqual(Array.from({ length: 50 }, (_, index) => index + 1));
    });

    it("CA7: the table is semantic with Rank, Player and Score column headers", async () => {
      const wrapper = mountPage(LeaderboardPage, apiStub());
      await flushPromises();

      const headers = wrapper.findAll("table thead th");
      expect(headers.map((th) => th.text())).toEqual(["Rank", "Player", "Score"]);
      headers.forEach((th) => expect(th.attributes("scope")).toBe("col"));
      const first = wrapper.findAll("table tbody tr")[0]!;
      expect(first.text()).toContain("Player 1");
      expect(first.text().replace(/\D/g, "")).toContain("99990");
    });

    it("CA7: shows the consolidation date", async () => {
      const wrapper = mountPage(LeaderboardPage, apiStub());
      await flushPromises();

      expect(wrapper.text()).toContain("Updated 3 min ago");
    });

    it("CA7: Refresh re-reads and displays the new ranking", async () => {
      const api = apiStub({
        getLeaderboard: vi
          .fn()
          .mockResolvedValueOnce(board())
          .mockResolvedValueOnce(
            board({ entries: [{ ...entry(1), playerName: "NewLeader" }] }),
          ),
      });
      const wrapper = mountPage(LeaderboardPage, api);
      await flushPromises();

      const refresh = button(wrapper, /^refresh$/i);
      expect(refresh, "Refresh button").toBeDefined();
      await refresh!.trigger("click");
      await flushPromises();

      expect(api.getLeaderboard).toHaveBeenCalledTimes(2);
      expect(wrapper.findAll("table tbody tr")).toHaveLength(1);
      expect(wrapper.text()).toContain("NewLeader");
    });

    it("CA7: the current player (seeded player, D5) is the one requested", async () => {
      const api = apiStub();
      mountPage(LeaderboardPage, api);
      await flushPromises();

      expect(api.getLeaderboard).toHaveBeenCalledWith(
        SEEDED_PLAYER_ID,
        expect.anything(),
      );
    });
  });

  describe('CA8 — my line in the top 50: "You" badge, aria-current, Show my position', () => {
    function boardWithMeAt(rank: number) {
      const entries = Array.from({ length: 50 }, (_, index) =>
        index + 1 === rank ? entry(rank, SEEDED_PLAYER_ID) : entry(index + 1),
      );
      return board({ entries, me: entry(rank, SEEDED_PLAYER_ID) });
    }

    it('CA8: only my row carries aria-current="true" and a visible "You" badge', async () => {
      const api = apiStub({
        getLeaderboard: vi.fn().mockResolvedValue(boardWithMeAt(7)),
      });
      const wrapper = mountPage(LeaderboardPage, api);
      await flushPromises();

      const current = wrapper.findAll('tbody tr[aria-current="true"]');
      expect(current).toHaveLength(1);
      expect(current[0]!.text()).toContain("Player 7");
      expect(youBadge(current[0]!), "You badge").toBeDefined();
      const others = wrapper
        .findAll("tbody tr")
        .filter((row) => row.attributes("aria-current") !== "true");
      expect(others).toHaveLength(49);
      expect(others.some((row) => youBadge(row) !== undefined)).toBe(false);
      expect(
        wrapper
          .find(".leaderboard-table__pinned, [aria-label='Your position']")
          .exists(),
      ).toBe(false);
    });

    it("CA8: my row is recognised even when the API sends me=null", async () => {
      const entries = Array.from({ length: 50 }, (_, index) =>
        index === 2 ? entry(3, SEEDED_PLAYER_ID) : entry(index + 1),
      );
      const api = apiStub({
        getLeaderboard: vi.fn().mockResolvedValue(board({ entries, me: null })),
      });
      const wrapper = mountPage(LeaderboardPage, api);
      await flushPromises();

      expect(wrapper.get('tbody tr[aria-current="true"]').text()).toContain("Player 3");
    });

    it('CA8: "Show my position" scrolls to my row and gives it focus', async () => {
      const scroll = vi.fn();
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: scroll,
      });
      const api = apiStub({
        getLeaderboard: vi.fn().mockResolvedValue(boardWithMeAt(42)),
      });
      const wrapper = mountPage(LeaderboardPage, api, true);
      await flushPromises();

      const show = button(wrapper, /show my position|voir ma position/i);
      expect(show, "Show my position button").toBeDefined();
      await show!.trigger("click");

      const myRow = wrapper.get('tbody tr[aria-current="true"]').element;
      expect(scroll).toHaveBeenCalled();
      expect(scroll.mock.contexts[0]).toBe(myRow);
      expect(document.activeElement).toBe(myRow);
      wrapper.unmount();
    });

    it("CA8: with reduced motion, the scroll is not animated", async () => {
      const scroll = vi.fn();
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: scroll,
      });
      vi.stubGlobal(
        "matchMedia",
        vi.fn().mockReturnValue({
          matches: true,
          addEventListener() {},
          removeEventListener() {},
        }),
      );
      window.matchMedia = globalThis.matchMedia;
      const api = apiStub({
        getLeaderboard: vi.fn().mockResolvedValue(boardWithMeAt(5)),
      });
      const wrapper = mountPage(LeaderboardPage, api, true);
      await flushPromises();

      await button(wrapper, /show my position/i)!.trigger("click");
      expect(scroll.mock.calls[0]?.[0]?.behavior ?? "auto").not.toBe("smooth");
      wrapper.unmount();
    });

    it('CA8: no "Show my position" button when I am not ranked at all', async () => {
      const wrapper = mountPage(LeaderboardPage, apiStub());
      await flushPromises();

      expect(button(wrapper, /show my position/i)).toBeUndefined();
      expect(wrapper.find('[aria-current="true"]').exists()).toBe(false);
    });
  });

  describe("CA9 — outside the top 50: my line pinned under the table", () => {
    it("CA9: shows my real rank and score under the table, not in it", async () => {
      const me = { ...entry(87, SEEDED_PLAYER_ID, 4321), playerName: "Me Myself" };
      const api = apiStub({ getLeaderboard: vi.fn().mockResolvedValue(board({ me })) });
      const wrapper = mountPage(LeaderboardPage, api, true);
      await flushPromises();

      expect(wrapper.findAll("tbody tr")).toHaveLength(50);
      expect(wrapper.find('tbody tr[aria-current="true"]').exists()).toBe(false);

      const pinned = wrapper.get('[aria-current="true"]');
      expect(pinned.text()).toContain("87");
      expect(pinned.text().replace(/\D/g, "")).toContain("4321");
      expect(pinned.text()).toContain("Me Myself");
      expect(youBadge(pinned), "You badge").toBeDefined();

      const table = wrapper.get("table").element;
      // pinned line follows the table in document order
      expect(
        table.compareDocumentPosition(pinned.element) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      wrapper.unmount();
    });

    it('CA9: "Show my position" focuses the pinned line', async () => {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: vi.fn(),
      });
      const me = entry(87, SEEDED_PLAYER_ID);
      const api = apiStub({ getLeaderboard: vi.fn().mockResolvedValue(board({ me })) });
      const wrapper = mountPage(LeaderboardPage, api, true);
      await flushPromises();

      await button(wrapper, /show my position/i)!.trigger("click");
      expect(document.activeElement).toBe(wrapper.get('[aria-current="true"]').element);
      wrapper.unmount();
    });

    it("CA9: me sent beyond the 50th entry is pinned with its real rank", async () => {
      const entries = Array.from({ length: 60 }, (_, index) =>
        index + 1 === 55 ? entry(55, SEEDED_PLAYER_ID) : entry(index + 1),
      );
      const api = apiStub({
        getLeaderboard: vi
          .fn()
          .mockResolvedValue(board({ entries, me: entry(55, SEEDED_PLAYER_ID) })),
      });
      const wrapper = mountPage(LeaderboardPage, api);
      await flushPromises();

      expect(wrapper.findAll("tbody tr")).toHaveLength(50);
      expect(wrapper.get('[aria-current="true"]').text()).toContain("55");
    });
  });

  describe("CA10 — empty leaderboard and failure", () => {
    it("CA10: empty ranking → explicit message, no error, no table", async () => {
      const api = apiStub({
        getLeaderboard: vi
          .fn()
          .mockResolvedValue({ consolidatedAt: null, entries: [], me: null }),
      });
      const wrapper = mountPage(LeaderboardPage, api);
      await flushPromises();

      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      expect(wrapper.find("table").exists()).toBe(false);
      expect(wrapper.text()).toMatch(/no player|nobody|empty/i);
      expect(button(wrapper, /^refresh$/i)).toBeDefined();
    });

    it("CA10: null body → treated as empty, not as an error", async () => {
      const api = apiStub({ getLeaderboard: vi.fn().mockResolvedValue(null) });
      const wrapper = mountPage(LeaderboardPage, api);
      await flushPromises();

      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      expect(wrapper.text()).toMatch(/no player|nobody|empty/i);
    });

    it("CA10: loading is announced (aria-live=polite)", async () => {
      const pending = deferred<LeaderboardResponse>();
      const api = apiStub({ getLeaderboard: vi.fn().mockReturnValue(pending.promise) });
      const wrapper = mountPage(LeaderboardPage, api);
      await nextTick();

      expect(liveRegion(wrapper).text()).toMatch(/loading/i);
      pending.resolve(board());
      await flushPromises();
      expect(liveRegion(wrapper).text()).not.toMatch(/loading/i);
    });

    it("CA10: failure → role=alert and Retry, which reloads the ranking", async () => {
      const api = apiStub({
        getLeaderboard: vi
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

      expect(api.getLeaderboard).toHaveBeenCalledTimes(2);
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      expect(wrapper.findAll("tbody tr")).toHaveLength(50);
    });

    it("CA10: a Gateway error without message still shows the alert and Retry", async () => {
      const api = apiStub({
        getLeaderboard: vi
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
        getLeaderboard: vi
          .fn()
          .mockResolvedValueOnce(board())
          .mockRejectedValueOnce(
            new GatewayError(503, { code: "D", message: "Down." }),
          ),
      });
      const wrapper = mountPage(LeaderboardPage, api);
      await flushPromises();
      await button(wrapper, /^refresh$/i)!.trigger("click");
      await flushPromises();

      expect(wrapper.find('[role="alert"]').exists()).toBe(true);
      expect(button(wrapper, /^retry$/i)).toBeDefined();
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

    it("CA12: ?mock=consolidating → discreet mention and pinned line", async () => {
      route.query = { mock: "consolidating" };
      useFakeTimeouts();
      const stats = mountPage(StatisticsPage);
      const ranking = mountPage(LeaderboardPage);
      await elapse(300);

      expect(stats.text()).toMatch(/consolidat/i);
      expect(stats.find('[role="alert"]').exists()).toBe(false);
      expect(ranking.find('tbody tr[aria-current="true"]').exists()).toBe(false);
      expect(ranking.find('[aria-current="true"]').exists()).toBe(true);
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

      expect(ranking.findAll("tbody tr")).toHaveLength(50);
      expect(youBadge(ranking.get('tbody tr[aria-current="true"]'))).toBeDefined();
    });

    it("CA12: an unknown ?mock= value falls back to played", async () => {
      route.query = { mock: "<script>" };
      useFakeTimeouts();
      const ranking = mountPage(LeaderboardPage);
      await elapse(300);

      expect(ranking.find('[role="alert"]').exists()).toBe(false);
      expect(ranking.findAll("tbody tr")).toHaveLength(50);
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
        apiStub({ getLeaderboard: vi.fn().mockResolvedValue(board({ entries: [] })) }),
      );
      const failed = mountPage(
        LeaderboardPage,
        apiStub({ getLeaderboard: vi.fn().mockRejectedValue(new Error("x")) }),
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
      const me = entry(87, SEEDED_PLAYER_ID);
      const stats = mountPage(StatisticsPage, apiStub());
      const ranking = mountPage(
        LeaderboardPage,
        apiStub({ getLeaderboard: vi.fn().mockResolvedValue(board({ me })) }),
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
      const entries = Array.from({ length: 50 }, (_, index) =>
        index === 0 ? entry(1, SEEDED_PLAYER_ID) : entry(index + 1),
      );
      const api = apiStub({
        getLeaderboard: vi.fn().mockResolvedValue(board({ entries, me: entries[0] })),
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
