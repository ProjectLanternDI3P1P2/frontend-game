import { describe, expect, it } from "vitest";
import {
  DEFAULT_HERO_APPEARANCE,
  HAIR_COLORS,
  SKIN_TONES,
  heroLayerNames,
  heroLayerUrls,
  resolveAppearance,
} from "../appearance";

describe("hero appearance", () => {
  it("offers the ten skin tones and thirteen hair colors of the asset, without v00", () => {
    expect(SKIN_TONES.map((tone) => tone.value)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(HAIR_COLORS).toHaveLength(13);
    expect(HAIR_COLORS[0]?.value).toBe(1);
  });

  it("stacks body, underwear then the class headwear, which hides the hair", () => {
    expect(
      heroLayerNames("mage", { skinTone: 7, hairStyle: "dap1", hairColor: 12 }),
    ).toEqual(["0bas_humn_v07", "1out_undi_v01", "5hat_pnty_v01"]);
    expect(
      heroLayerNames("shaman", { skinTone: 2, hairStyle: "bob1", hairColor: 3 }),
    ).toEqual(["0bas_humn_v02", "1out_undi_v01", "5hat_pfht_v04"]);
  });

  it("draws the chosen hair when bare-headed", () => {
    expect(
      heroLayerNames("warrior", { skinTone: 7, hairStyle: "dap1", hairColor: 12 }),
    ).toEqual(["0bas_humn_v07", "1out_undi_v01", "4har_dap1_v12"]);
    expect(
      heroLayerNames(null, { skinTone: 2, hairStyle: "bob1", hairColor: 3 }),
    ).toEqual(["0bas_humn_v02", "1out_undi_v01", "4har_bob1_v03"]);
  });

  it("draws the warrior bare-headed and a bald hero without hair", () => {
    expect(
      heroLayerNames("warrior", { skinTone: 10, hairStyle: "bald", hairColor: null }),
    ).toEqual(["0bas_humn_v10", "1out_undi_v01"]);
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

  it("resolves every layer to a bundled sheet", () => {
    for (const tone of SKIN_TONES) {
      for (const hairStyle of ["bob1", "dap1"] as const) {
        for (const color of HAIR_COLORS) {
          const appearance = {
            skinTone: tone.value,
            hairStyle,
            hairColor: color.value,
          };
          expect(heroLayerUrls(null, appearance)).toHaveLength(3);
          expect(heroLayerUrls("mage", appearance)).toHaveLength(3);
          expect(heroLayerUrls("shaman", appearance)).toHaveLength(3);
          expect(heroLayerUrls("warrior", appearance)).toHaveLength(3);
        }
      }
    }
  });
});
