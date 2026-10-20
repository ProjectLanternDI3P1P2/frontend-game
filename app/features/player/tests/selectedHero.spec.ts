import { describe, expect, it } from "vitest";
import { findSelectedHeroId } from "../utils/selectedHero";
import type { HeroSummary } from "../types";

const hero = (id: string, isSelected = false): HeroSummary => ({
  id,
  name: id,
  classCode: "warrior",
  level: 1,
  maximumHealth: 60,
  isEngagedInActiveSession: false,
  isSelected,
});

describe("findSelectedHeroId", () => {
  it("does not select a hero when the roster has no backend selection", () => {
    expect(findSelectedHeroId([hero("first"), hero("second")])).toBeNull();
  });

  it("returns the hero explicitly selected by the backend", () => {
    expect(findSelectedHeroId([hero("first"), hero("second", true)])).toBe("second");
  });
});
