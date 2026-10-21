import { describe, expect, it } from "vitest";
import { STATISTICS_CATALOGUE } from "../statisticsCatalogue";
import {
  formatConsolidationAge,
  formatCount,
  groupHeroStatistics,
} from "../statisticsRules";
import { StatisticCategory } from "../types";

const NOW = new Date("2026-10-21T12:00:00Z");

describe("statistics catalogue", () => {
  it("holds about fifteen unique keys spread over the four categories", () => {
    const keys = STATISTICS_CATALOGUE.map((definition) => definition.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBeGreaterThanOrEqual(12);
    expect(new Set(STATISTICS_CATALOGUE.map((d) => d.category))).toEqual(
      new Set(Object.values(StatisticCategory)),
    );
  });
});

describe("groupHeroStatistics", () => {
  it("groups every catalogue statistic by category, in catalogue order", () => {
    const groups = groupHeroStatistics({
      statistics: [
        { key: "combats_won", value: 4 },
        { key: "games_played", value: 12 },
      ],
    });

    expect(groups.map((group) => group.label)).toEqual([
      "Games",
      "Dungeon",
      "Combat",
      "Rewards",
    ]);
    expect(groups.flatMap((group) => group.statistics)).toHaveLength(
      STATISTICS_CATALOGUE.length,
    );
    const values = Object.fromEntries(
      groups.flatMap((group) => group.statistics).map((s) => [s.key, s.value]),
    );
    expect(values.games_played).toBe(12);
    expect(values.combats_won).toBe(4);
    expect(values.chests_opened).toBe(0);
  });

  it("shows 0 for every statistic when the response is empty or absent", () => {
    for (const response of [null, undefined, { statistics: [] }]) {
      const all = groupHeroStatistics(response).flatMap((group) => group.statistics);
      expect(all).toHaveLength(STATISTICS_CATALOGUE.length);
      expect(all.every((statistic) => statistic.value === 0)).toBe(true);
    }
  });

  it("ignores unknown keys and treats invalid values as 0", () => {
    const all = groupHeroStatistics({
      statistics: [
        { key: "unknown", value: 9 },
        { key: "games_played", value: Number.NaN },
        { key: "rooms_explored", value: -3 },
      ],
    }).flatMap((group) => group.statistics);

    expect(all.some((statistic) => statistic.key === "unknown")).toBe(false);
    expect(all.find((s) => s.key === "games_played")?.value).toBe(0);
    expect(all.find((s) => s.key === "rooms_explored")?.value).toBe(0);
  });
});

describe("formatConsolidationAge", () => {
  it.each([
    [null, "Not consolidated yet"],
    ["not a date", "Not consolidated yet"],
    ["2026-10-21T11:59:30Z", "Updated just now"],
    ["2026-10-21T12:00:30Z", "Updated just now"],
    ["2026-10-21T11:57:00Z", "Updated 3 min ago"],
    ["2026-10-21T09:30:00Z", "Updated 2 h ago"],
    ["2026-10-20T11:00:00Z", "Updated 1 day ago"],
    ["2026-10-18T11:00:00Z", "Updated 3 days ago"],
  ])("%s → %s", (consolidatedAt, label) => {
    expect(formatConsolidationAge(consolidatedAt, NOW)).toBe(label);
  });
});

describe("formatCount", () => {
  it("groups thousands", () => {
    expect(formatCount(12450)).toBe("12,450");
    expect(formatCount(0)).toBe("0");
  });
});
