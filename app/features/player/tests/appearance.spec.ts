import { describe, expect, it } from "vitest";
import {
  HERO_CATALOGUE,
  HERO_SLOTS,
  heroSheetPath,
  heroSheetUrl,
  type HeroPage,
  type HeroSlot,
} from "../appearance";

describe("hero appearance catalogue", () => {
  it("has a sheet for every piece and colour it lists, from v01", () => {
    for (const [page, slots] of Object.entries(HERO_CATALOGUE)) {
      for (const [slot, styles] of Object.entries(slots)) {
        for (const [style, variants] of Object.entries(styles)) {
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
