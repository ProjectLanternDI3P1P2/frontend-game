import { describe, expect, it } from "vitest";
import {
  DEFAULT_HERO_APPEARANCE,
  HAIR_COLORS,
  HAIR_STYLES,
  SKIN_TONES,
} from "~/features/player/appearance";
import {
  HERO_STANCES,
  heroAppearanceFromPlayer,
  heroAppearanceOf,
  heroLayers,
  isKnownPlayerAppearance,
  type HeroAppearance,
} from "../tiles/hero";
import type { Direction } from "../types";

const RUN_ID = "0199a5b2-0000-7000-8000-000000000042";
const FACINGS: Direction[] = ["south", "north", "east", "west"];

/** The file names of the sheets the viewport stacks, back to front. */
function sheetsOf(appearance: HeroAppearance, facing: Direction = "south"): string[] {
  return heroLayers(appearance, facing)
    .sort((a, b) => a.depth - b.depth)
    .map(({ sheet }) => sheet.split("/").at(-1)!.split("?")[0]!);
}

/** The body and hair the viewport draws, as Player's codes. */
function lookOf(appearance: HeroAppearance) {
  return {
    skinTone: appearance.body.variant,
    hairStyle: appearance.hair?.style ?? "bald",
    hairColor: appearance.hair?.variant ?? null,
  };
}

describe("heroAppearanceFromPlayer", () => {
  it("draws the skin and hair chosen in the hero editor", () => {
    const appearance = heroAppearanceFromPlayer(RUN_ID, {
      skinTone: 7,
      hairStyle: "dap1",
      hairColor: 12,
    });

    expect(lookOf(appearance)).toEqual({
      skinTone: 7,
      hairStyle: "dap1",
      hairColor: 12,
    });
    const sheets = sheetsOf(appearance);
    expect(sheets.some((sheet) => sheet.includes("_0bas_humn_v07"))).toBe(true);
    expect(sheets.some((sheet) => sheet.includes("_4har_dap1_v12"))).toBe(true);
  });

  it("keeps the hero bare-headed, so the chosen hair is never hidden by a hat", () => {
    for (let index = 0; index < 50; index++) {
      const appearance = heroAppearanceFromPlayer(`run-${index}`, {
        skinTone: 1,
        hairStyle: "bob1",
        hairColor: 3,
      });
      expect(appearance.hat).toBeNull();
      expect(heroLayers(appearance, "south").map(({ slot }) => slot)).toContain("hair");
    }
  });

  it("draws a bald hero without any hair layer", () => {
    const appearance = heroAppearanceFromPlayer(RUN_ID, {
      skinTone: 4,
      hairStyle: "bald",
      hairColor: null,
    });

    expect(appearance.hair).toBeNull();
    for (const facing of FACINGS) {
      expect(heroLayers(appearance, facing).map(({ slot }) => slot)).not.toContain(
        "hair",
      );
    }
  });

  it("keeps the gear drawn for the run: the look changes the hero, not its weapon", () => {
    const drawn = heroAppearanceOf(RUN_ID);
    const chosen = heroAppearanceFromPlayer(RUN_ID, {
      skinTone: 2,
      hairStyle: "bob1",
      hairColor: 5,
    });

    expect(chosen).toMatchObject({
      stance: drawn.stance,
      outfit: drawn.outfit,
      weapon: drawn.weapon,
      shield: drawn.shield,
    });
  });

  it.each([
    ["no look at all", null],
    ["an undefined look", undefined],
    ["an empty look", {}],
  ])("falls back to the default look for %s", (_case, chosen) => {
    expect(lookOf(heroAppearanceFromPlayer(RUN_ID, chosen))).toEqual(
      DEFAULT_HERO_APPEARANCE,
    );
  });

  it.each([
    [
      "an unknown skin tone",
      { skinTone: 99, hairStyle: "dap1", hairColor: 4 },
      "skinTone",
    ],
    [
      "a skin tone sent as text",
      { skinTone: "3", hairStyle: "dap1", hairColor: 4 },
      "skinTone",
    ],
    [
      "an unknown hair style",
      { skinTone: 3, hairStyle: "mohawk", hairColor: 4 },
      "hairStyle",
    ],
    [
      "an unknown hair colour",
      { skinTone: 3, hairStyle: "dap1", hairColor: 0 },
      "hairColor",
    ],
    [
      "no hair colour for a haired hero",
      { skinTone: 3, hairStyle: "dap1", hairColor: null },
      "hairColor",
    ],
  ] as const)(
    "replaces only the part it cannot draw, for %s",
    (_case, chosen, wrongField) => {
      const look = lookOf(heroAppearanceFromPlayer(RUN_ID, chosen));
      const expected = { skinTone: 3, hairStyle: "dap1", hairColor: 4 };

      expect(look).toEqual({
        ...expected,
        [wrongField]: DEFAULT_HERO_APPEARANCE[wrongField],
      });
    },
  );

  it("draws every look the hero editor offers, in every fighting style and facing", () => {
    // Guards the two catalogues (Player's editor, the dungeon's sheets) against drifting apart:
    // `heroSheetUrl` throws on a sheet that does not exist.
    const runOfStance = new Map<string, string>();
    for (let index = 0; runOfStance.size < HERO_STANCES.length; index++) {
      const runId = `stance-${index}`;
      runOfStance.set(heroAppearanceOf(runId).stance, runId);
    }
    for (const runId of runOfStance.values()) {
      for (const tone of SKIN_TONES) {
        for (const style of HAIR_STYLES) {
          for (const color of HAIR_COLORS) {
            const appearance = heroAppearanceFromPlayer(runId, {
              skinTone: tone.value,
              hairStyle: style.value,
              hairColor: style.value === "bald" ? null : color.value,
            });
            for (const facing of FACINGS) {
              expect(() => heroLayers(appearance, facing)).not.toThrow();
            }
          }
        }
      }
    }
  });
});

describe("isKnownPlayerAppearance", () => {
  it("accepts a look made only of codes the client can draw", () => {
    expect(
      isKnownPlayerAppearance({ skinTone: 10, hairStyle: "bob1", hairColor: 13 }),
    ).toBe(true);
    expect(
      isKnownPlayerAppearance({ skinTone: 1, hairStyle: "bald", hairColor: null }),
    ).toBe(true);
  });

  it.each([
    ["no look", null],
    ["an empty look", {}],
    ["an unknown skin tone", { skinTone: 11, hairStyle: "bob1", hairColor: 1 }],
    ["an unknown hair style", { skinTone: 1, hairStyle: "BOB1", hairColor: 1 }],
    ["an unknown hair colour", { skinTone: 1, hairStyle: "bob1", hairColor: 14 }],
  ])("rejects %s", (_case, chosen) => {
    expect(isKnownPlayerAppearance(chosen)).toBe(false);
  });
});
