import { describe, expect, it } from "vitest";
import {
  classFilterHidesMe,
  formatDateTime,
  formatLag,
  previousSeasonLabel,
} from "../rankingViewRules";
import { HeroClass } from "../types";
import { entry } from "./fixtures/leaderboardFixtures";

describe("rankingViewRules", () => {
  it("formatLag: edge values", () => {
    expect(formatLag(null)).toBe("an unknown time");
    expect(formatLag(-1)).toBe("an unknown time");
    expect(formatLag(Number.NaN)).toBe("an unknown time");
    expect(formatLag(1)).toBe("1 second");
    expect(formatLag(59.4)).toBe("59 seconds");
    expect(formatLag(60)).toBe("1 min");
    expect(formatLag(3600)).toBe("1 h");
    expect(formatLag(7500)).toBe("2 h 5 min");
  });

  it("formatDateTime: missing or invalid dates read an unknown time", () => {
    expect(formatDateTime(undefined)).toBe("an unknown time");
    expect(formatDateTime("not a date")).toBe("an unknown time");
    expect(formatDateTime("2026-10-21T11:53:00Z")).toMatch(/21 Oct 2026.*11:53 UTC$/);
  });

  it("previousSeasonLabel: unexpected ids read Previous season", () => {
    expect(previousSeasonLabel("season-03")).toBe("Season 3");
    expect(previousSeasonLabel("legacy")).toBe("Previous season");
    expect(previousSeasonLabel("")).toBe("Previous season");
    expect(previousSeasonLabel(null)).toBe("Previous season");
  });

  it("classFilterHidesMe: only a class filter alone with none of my heroes", () => {
    const mine = [entry(7, "p-me")];
    const mage = { heroClass: HeroClass.MAGE, search: "" };
    expect(classFilterHidesMe(mage, [])).toBe(true);
    expect(classFilterHidesMe(mage, mine)).toBe(false);
    expect(classFilterHidesMe({ heroClass: null, search: "" }, [])).toBe(false);
    expect(classFilterHidesMe({ ...mage, search: " rune " }, [])).toBe(false);
    expect(classFilterHidesMe({ ...mage, search: "   " }, [])).toBe(true);
  });
});
