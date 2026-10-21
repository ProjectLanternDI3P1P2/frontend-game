import { describe, expect, it } from "vitest";
import {
  HERO_CATALOGUE,
  HERO_SLOTS,
  heroSheetPath,
  heroSheetUrl,
  DEFAULT_HERO_APPEARANCE,
  HAIR_COLORS,
  SKIN_TONES,
  heroLayerPieces,
  heroLayerUrls,
  resolveAppearance,
  type HeroPage,
  type HeroSlot,
  type HeroStyles,
} from "../appearance";

describe("hero appearance catalogue", () => {
  it("has a sheet for every piece and colour it lists, from v01", () => {
    for (const [page, slots] of Object.entries(HERO_CATALOGUE)) {
      for (const [slot, styles] of Object.entries(slots)) {
        for (const [style, variants] of Object.entries(styles as HeroStyles)) {
          expect(variants).toBeGreaterThan(0);
          for (let variant = 1; variant <= variants; variant++) {
            expect(() =>
              heroSheetUrl(page as HeroPage, slot as HeroSlot, { style, variant }),
            ).not.toThrow();
          }
        }
      }
    }
  });

  it("files the sheets by slot, under the art's own names", () => {
    expect(heroSheetPath("pONE2", "body", { style: "humn", variant: 3 })).toBe(
      "body/char_a_pONE2_0bas_humn_v03.webp",
    );
    expect(heroSheetPath("p1", "hair", { style: "bob1", variant: 5 })).toBe(
      "hair/char_a_p1_4har_bob1_v05.webp",
    );
    expect(heroSheetPath("pONE2", "weapon", { style: "sw01", variant: 5 })).toBe(
      "weapon/char_a_pONE2_6tla_sw01_v05.webp",
    );
  });

  it("refuses a sheet the repository does not have", () => {
    expect(() => heroSheetUrl("pONE2", "hair", { style: "bob1", variant: 0 })).toThrow(
      /Missing hero sheet/,
    );
  });

  it("stacks the body at the back and the hat over the hair", () => {
    expect(HERO_SLOTS[0]).toBe("body");
    expect(HERO_SLOTS.indexOf("hair")).toBeLessThan(HERO_SLOTS.indexOf("hat"));
  });
});

const sheets = (pieces: ReturnType<typeof heroLayerPieces>) =>
  pieces.map(({ slot, piece }) => heroSheetPath("p1", slot, piece));

describe("hero customization", () => {
  it("offers the ten skin tones and thirteen hair colors of the asset, without v00", () => {
    expect(SKIN_TONES.map((tone) => tone.value)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(HAIR_COLORS).toHaveLength(13);
    expect(HAIR_COLORS[0]?.value).toBe(1);
  });

  it("stacks body, underwear then the class headwear, which hides the hair", () => {
    expect(
      sheets(
        heroLayerPieces("mage", { skinTone: 7, hairStyle: "dap1", hairColor: 12 }),
      ),
    ).toEqual([
      "body/char_a_p1_0bas_humn_v07.webp",
      "outfit/char_a_p1_1out_undi_v01.webp",
      "hat/char_a_p1_5hat_pnty_v01.webp",
    ]);
    expect(
      sheets(
        heroLayerPieces("shaman", { skinTone: 2, hairStyle: "bob1", hairColor: 3 }),
      ),
    ).toEqual([
      "body/char_a_p1_0bas_humn_v02.webp",
      "outfit/char_a_p1_1out_undi_v01.webp",
      "hat/char_a_p1_5hat_pfht_v04.webp",
    ]);
  });

  it("draws the chosen hair when bare-headed, and none for a bald hero", () => {
    expect(
      sheets(
        heroLayerPieces("warrior", { skinTone: 7, hairStyle: "dap1", hairColor: 12 }),
      ),
    ).toEqual([
      "body/char_a_p1_0bas_humn_v07.webp",
      "outfit/char_a_p1_1out_undi_v01.webp",
      "hair/char_a_p1_4har_dap1_v12.webp",
    ]);
    expect(
      sheets(
        heroLayerPieces("warrior", {
          skinTone: 10,
          hairStyle: "bald",
          hairColor: null,
        }),
      ),
    ).toEqual([
      "body/char_a_p1_0bas_humn_v10.webp",
      "outfit/char_a_p1_1out_undi_v01.webp",
    ]);
  });

  it("falls back to the default look for missing or unknown values", () => {
    expect(resolveAppearance(undefined)).toEqual(DEFAULT_HERO_APPEARANCE);
    expect(
      resolveAppearance({ skinTone: 42, hairStyle: "bob1", hairColor: 99 }),
    ).toEqual(DEFAULT_HERO_APPEARANCE);
    expect(resolveAppearance({ skinTone: 4, hairStyle: "bald", hairColor: 6 })).toEqual(
      {
        skinTone: 4,
        hairStyle: "bald",
        hairColor: null,
      },
    );
  });

  it("resolves every choice to a bundled sheet", () => {
    for (const tone of SKIN_TONES) {
      for (const hairStyle of ["bob1", "dap1"] as const) {
        for (const color of HAIR_COLORS) {
          const appearance = {
            skinTone: tone.value,
            hairStyle,
            hairColor: color.value,
          };
          for (const classCode of [null, "warrior", "shaman", "mage"] as const) {
            expect(heroLayerUrls(classCode, appearance)).toHaveLength(3);
          }
        }
      }
    }
  });
});
