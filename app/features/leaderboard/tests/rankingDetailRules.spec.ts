import { describe, expect, it } from "vitest";
import {
  FACT_STATUS_LABELS,
  formatDate,
  formatNumber,
  formatRoom,
  formatXpGain,
  formatXpProgress,
  publicProfilePath,
  RUN_OUTCOME_LABELS,
  xpPercent,
} from "../rankingDetailRules";
import { FactStatus, RunOutcome } from "../types";

describe("rankingDetailRules", () => {
  it("xpPercent rounds and clamps to 0..100", () => {
    expect(xpPercent(1200, 3000)).toBe(40);
    expect(xpPercent(1, 3)).toBe(33);
    expect(xpPercent(0, 3000)).toBe(0);
    expect(xpPercent(3000, 3000)).toBe(100);
    expect(xpPercent(5000, 3000)).toBe(100);
    expect(xpPercent(-10, 3000)).toBe(0);
    expect(xpPercent(10, 0)).toBe(0);
    expect(xpPercent(Number.NaN, 100)).toBe(0);
  });

  it("formats XP, rooms and counts", () => {
    expect(formatXpProgress(1200, 3000)).toBe("1,200 / 3,000 XP");
    expect(formatRoom(7, 12)).toBe("7 / 12");
    expect(formatXpGain(340)).toBe("+340 XP");
    expect(formatXpGain(0)).toBe("0 XP");
    expect(formatNumber(Number.NaN)).toBe("0");
  });

  it("formatDate reads a UTC day and 'Unknown' for missing or invalid dates", () => {
    expect(formatDate("2026-03-04T23:30:00Z")).toBe("4 Mar 2026");
    expect(formatDate("not a date")).toBe("Unknown");
    expect(formatDate(null)).toBe("Unknown");
    expect(formatDate("")).toBe("Unknown");
  });

  it("publicProfilePath points to the player's heroes, none for a deleted player", () => {
    expect(publicProfilePath("player-1")).toBe("/players/player-1/heroes");
    expect(publicProfilePath("a/b")).toBe("/players/a%2Fb/heroes");
    expect(publicProfilePath(null)).toBeNull();
    expect(publicProfilePath("")).toBeNull();
  });

  it("labels every outcome and fact status in text", () => {
    expect(Object.values(RunOutcome).map((o) => RUN_OUTCOME_LABELS[o])).toEqual([
      "Victory",
      "Defeat",
      "Abandoned",
    ]);
    expect(Object.values(FactStatus).map((s) => FACT_STATUS_LABELS[s])).toEqual([
      "Applied",
      "Pending",
      "Rejected",
    ]);
  });
});
