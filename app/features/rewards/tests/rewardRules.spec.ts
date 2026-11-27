import { describe, expect, it } from "vitest";
import { describeRecipient, normalizeRarity } from "../rewardRules";

const names = new Map([["h1", "Aria"]]);

describe("describeRecipient", () => {
  it("names the receiving hero and flags the connected player", () => {
    const view = describeRecipient(
      { heroId: "h1", playerId: "p1", itemInstanceId: null },
      names,
      "p1",
    );
    expect(view).toEqual({ heroId: "h1", heroName: "Aria", owner: "you", isYou: true });
  });

  it("does not flag another player or a missing player id", () => {
    expect(
      describeRecipient(
        { heroId: "h1", playerId: "p2", itemInstanceId: "i" },
        names,
        "p1",
      ).isYou,
    ).toBe(false);
    expect(
      describeRecipient(
        { heroId: "h1", playerId: null, itemInstanceId: "i" },
        names,
        "p1",
      ).isYou,
    ).toBe(false);
  });

  it("identifies another participant as a teammate and an unknown player as unknown", () => {
    const recipient = { heroId: "h1", playerId: "p2", itemInstanceId: null };
    expect(describeRecipient(recipient, names, "p1").owner).toBe("teammate");
    expect(describeRecipient({ ...recipient, playerId: null }, names, "p1").owner).toBe(
      "unknown",
    );
    expect(describeRecipient(recipient, names, null).owner).toBe("unknown");
  });

  it("falls back to a neutral label for a hero outside the session", () => {
    expect(
      describeRecipient(
        { heroId: "x", playerId: "p2", itemInstanceId: null },
        names,
        "p1",
      ).heroName,
    ).toBe("Unknown hero");
  });
});

describe("normalizeRarity", () => {
  it("ignores casing", () => {
    expect(normalizeRarity(" Legendary ")).toBe("legendary");
  });
});
