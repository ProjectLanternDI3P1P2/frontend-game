import { describe, expect, it } from "vitest";
import { describeRecipient, normalizeRarity } from "../rewardRules";

const names = new Map([["h1", "Aria"]]);

describe("describeRecipient", () => {
  it("flags the connected player's recipient by player ID", () => {
    const view = describeRecipient(
      { heroId: "h1", playerId: "p1", itemInstanceId: null },
      names,
      "p1",
    );
    expect(view).toEqual({ heroId: "h1", heroName: "Aria", owner: "you" });
  });

  it("still flags the connected player when the hero is no longer known", () => {
    expect(
      describeRecipient(
        { heroId: "gone", playerId: "p1", itemInstanceId: null },
        names,
        "p1",
      ),
    ).toEqual({ heroId: "gone", heroName: "Unknown hero", owner: "you" });
  });

  it("identifies another player as a teammate", () => {
    expect(
      describeRecipient(
        { heroId: "h1", playerId: "p2", itemInstanceId: "i" },
        names,
        "p1",
      ).owner,
    ).toBe("teammate");
  });

  it("stays neutral without the viewer or recipient player ID", () => {
    const recipient = { heroId: "h1", playerId: "p1", itemInstanceId: null };
    expect(describeRecipient(recipient, names, null).owner).toBe("unknown");
    expect(describeRecipient({ ...recipient, playerId: null }, names, "p1").owner).toBe(
      "unknown",
    );
  });
});

describe("normalizeRarity", () => {
  it("ignores casing", () => {
    expect(normalizeRarity(" Legendary ")).toBe("legendary");
  });
});
