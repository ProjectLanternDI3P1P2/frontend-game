import { describe, expect, it } from "vitest";
import { describeRecipient, normalizeRarity } from "../rewardRules";

const names = new Map([
  ["h1", "Aria"],
  ["h2", "Bran"],
]);
const ownHeroes = new Set(["h1"]);

describe("describeRecipient", () => {
  it("flags a hero of the connected player, whatever the player ID", () => {
    const view = describeRecipient(
      { heroId: "h1", playerId: "0b8f7c1e-uuid", itemInstanceId: null },
      names,
      ownHeroes,
    );
    expect(view).toEqual({ heroId: "h1", heroName: "Aria", owner: "you" });
  });

  it("identifies another hero of the session as a teammate", () => {
    expect(
      describeRecipient(
        { heroId: "h2", playerId: null, itemInstanceId: "i" },
        names,
        ownHeroes,
      ).owner,
    ).toBe("teammate");
  });

  it("stays neutral without the player's heroes or for a hero outside the session", () => {
    const recipient = { heroId: "h1", playerId: "p1", itemInstanceId: null };
    expect(describeRecipient(recipient, names, null).owner).toBe("unknown");
    const outsider = describeRecipient(
      { heroId: "x", playerId: "p2", itemInstanceId: null },
      names,
      ownHeroes,
    );
    expect(outsider).toEqual({
      heroId: "x",
      heroName: "Unknown hero",
      owner: "unknown",
    });
  });
});

describe("normalizeRarity", () => {
  it("ignores casing", () => {
    expect(normalizeRarity(" Legendary ")).toBe("legendary");
  });
});
