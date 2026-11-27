import { describe, expect, it } from "vitest";
import {
  DEFAULT_RANKING_STATE,
  defaultRankingQuery,
  displayPlayerName,
  formatRankDelta,
  formatRelativeTime,
  formatWinRate,
  HERO_CLASS_LABELS,
  parseRankingQuery,
  podiumMedal,
  positionsBetween,
  RANKING_PAGE_SIZE,
  RANKING_PERIOD_LABELS,
  RANKING_SORT_LABELS,
  RankDeltaDirection,
  toRouteQuery,
} from "../leaderboardRules";
import { HeroClass, RankingPeriod, RankingSort } from "../types";

const NOW = new Date("2026-10-21T12:00:00Z");

function ago(milliseconds: number): string {
  return new Date(NOW.getTime() - milliseconds).toISOString();
}

describe("formatRankDelta", () => {
  it.each([
    [3, "▲ 3", RankDeltaDirection.UP],
    [-2, "▼ 2", RankDeltaDirection.DOWN],
    [0, "— 0", RankDeltaDirection.STABLE],
    [null, "NEW", RankDeltaDirection.NEW],
    [Number.NaN, "NEW", RankDeltaDirection.NEW],
  ])("%s → %s", (delta, label, direction) => {
    expect(formatRankDelta(delta)).toEqual({ label, direction });
  });
});

describe("podiumMedal", () => {
  it("gives gold, silver and bronze to the first three only", () => {
    expect([1, 2, 3, 4, 0, -1].map(podiumMedal)).toEqual([
      "gold",
      "silver",
      "bronze",
      null,
      null,
      null,
    ]);
  });
});

describe("positionsBetween", () => {
  it("counts the ranks strictly between the last visible line and mine", () => {
    expect(positionsBetween(10, 58)).toBe(47);
    expect(positionsBetween(10, 11)).toBe(0);
  });

  it("never goes below 0", () => {
    expect(positionsBetween(10, 7)).toBe(0);
    expect(positionsBetween(10, Number.NaN)).toBe(0);
  });
});

describe("formatWinRate", () => {
  it("rounds to a whole percentage", () => {
    expect(formatWinRate(0.43)).toBe("43%");
    expect(formatWinRate(0.666)).toBe("67%");
    expect(formatWinRate(0)).toBe("0%");
    expect(formatWinRate(1)).toBe("100%");
  });

  it("clamps out-of-range and invalid values", () => {
    expect(formatWinRate(1.4)).toBe("100%");
    expect(formatWinRate(-0.2)).toBe("0%");
    expect(formatWinRate(Number.NaN)).toBe("0%");
  });
});

describe("formatRelativeTime", () => {
  it.each([
    [0, "just now"],
    [1_000, "1 second ago"],
    [12_000, "12 seconds ago"],
    [3 * 60_000, "3 min ago"],
    [59 * 60_000 + 59_000, "59 min ago"],
    [2 * 3_600_000, "2 h ago"],
    [24 * 3_600_000, "1 day ago"],
    [5 * 24 * 3_600_000, "5 days ago"],
  ])("%i ms → %s", (elapsed, label) => {
    expect(formatRelativeTime(ago(elapsed), NOW)).toBe(label);
  });

  it("reads a future date as just now and a missing or invalid one as Never", () => {
    expect(formatRelativeTime(ago(-60_000), NOW)).toBe("just now");
    expect(formatRelativeTime(null, NOW)).toBe("Never");
    expect(formatRelativeTime("not a date", NOW)).toBe("Never");
  });
});

describe("displayPlayerName", () => {
  it("shows the player's name, or Anonymous hero for a deleted player", () => {
    expect(displayPlayerName({ playerName: "Brenna" })).toBe("Brenna");
    expect(displayPlayerName({ playerName: null })).toBe("Anonymous hero");
    expect(displayPlayerName({ playerName: "  " })).toBe("Anonymous hero");
  });
});

describe("labels", () => {
  it("names every class, period and sort", () => {
    expect(Object.keys(HERO_CLASS_LABELS)).toEqual(Object.values(HeroClass));
    expect(Object.keys(RANKING_PERIOD_LABELS)).toEqual(Object.values(RankingPeriod));
    expect(Object.keys(RANKING_SORT_LABELS)).toEqual(Object.values(RankingSort));
    expect(HERO_CLASS_LABELS[HeroClass.SHAMAN]).toBe("Shaman");
    expect(RANKING_SORT_LABELS[RankingSort.TOTAL_XP]).toBe("Total XP");
  });
});

describe("parseRankingQuery / toRouteQuery", () => {
  it("defaults to all classes, all time, no search, by total XP, page 1 of 10", () => {
    expect(parseRankingQuery({})).toEqual({
      heroClass: null,
      period: RankingPeriod.ALL_TIME,
      search: "",
      sort: RankingSort.TOTAL_XP,
      page: 1,
      pageSize: RANKING_PAGE_SIZE,
    });
    expect(parseRankingQuery(undefined)).toEqual(DEFAULT_RANKING_STATE);
    expect(defaultRankingQuery("p")).toEqual({
      ...DEFAULT_RANKING_STATE,
      playerId: "p",
    });
    expect(RANKING_PAGE_SIZE).toBe(10);
  });

  it("reads valid values", () => {
    expect(
      parseRankingQuery({
        class: "mage",
        period: "season",
        search: "  Brenna ",
        sort: "win-rate",
        page: "4",
        mock: "lagging",
      }),
    ).toEqual({
      heroClass: HeroClass.MAGE,
      period: RankingPeriod.SEASON,
      search: "Brenna",
      sort: RankingSort.WIN_RATE,
      page: 4,
      pageSize: RANKING_PAGE_SIZE,
    });
  });

  it.each([
    ["unknown class", { class: "rogue" }],
    ["unknown period", { period: "month" }],
    ["unknown sort", { sort: "name" }],
    ["page 0", { page: "0" }],
    ["negative page", { page: "-2" }],
    ["decimal page", { page: "1.5" }],
    ["non-numeric page", { page: "two" }],
    ["absurd page", { page: "99999999999" }],
    ["null values", { class: null, period: null, sort: null, page: null }],
    ["non-string values", { class: 1, period: {}, search: 42, page: 3 }],
  ])("brings back the default for %s", (_label, routeQuery) => {
    expect(parseRankingQuery(routeQuery)).toEqual(DEFAULT_RANKING_STATE);
  });

  it("takes the first of repeated values and ignores case and spaces", () => {
    expect(
      parseRankingQuery({ class: ["SHAMAN", "mage"], period: [" Week "], page: ["2"] }),
    ).toMatchObject({
      heroClass: HeroClass.SHAMAN,
      period: RankingPeriod.WEEK,
      page: 2,
    });
  });

  it("bounds the search length", () => {
    expect(parseRankingQuery({ search: "x".repeat(200) }).search).toHaveLength(64);
  });

  it("writes only what differs from the default", () => {
    expect(toRouteQuery(DEFAULT_RANKING_STATE)).toEqual({});
    expect(
      toRouteQuery({
        heroClass: HeroClass.WARRIOR,
        period: RankingPeriod.WEEK,
        search: " maelis ",
        sort: RankingSort.LAST_ACTIVITY,
        page: 3,
      }),
    ).toEqual({
      class: "warrior",
      period: "week",
      search: "maelis",
      sort: "last-activity",
      page: "3",
    });
  });

  it("round-trips through the URL", () => {
    const state = {
      heroClass: HeroClass.SHAMAN,
      period: RankingPeriod.SEASON,
      search: "storm",
      sort: RankingSort.LEVEL,
      page: 2,
      pageSize: RANKING_PAGE_SIZE,
    };
    expect(parseRankingQuery(toRouteQuery(state))).toEqual(state);
  });
});
