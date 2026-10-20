import { describe, expect, it } from "vitest";
import {
  HERO_SHEET,
  HERO_WARDROBE,
  heroAppearanceOf,
  heroLayers,
  heroSheetPath,
  heroSprite,
  randomHeroAppearance,
  type HeroAppearance,
  type HeroSlot,
} from "../tiles/hero";
import { heroSheetUrl } from "../tiles/heroSheets";
import type { Direction } from "../types";

const FACINGS: Direction[] = ["south", "north", "east", "west"];

/** Always draws the same number: the first piece and colour of every slot. */
const lowest = () => 0;

describe("hero", () => {
  it("draws the same hero for a run every time, and others for other runs", () => {
    const runId = "0199a5b2-0000-7000-8000-000000000001";
    expect(heroAppearanceOf(runId)).toEqual(heroAppearanceOf(runId));

    const looks = new Set(
      Array.from({ length: 20 }, (_, index) =>
        JSON.stringify(
          heroAppearanceOf(
            `0199a5b2-0000-7000-8000-${String(index).padStart(12, "0")}`,
          ),
        ),
      ),
    );
    expect(looks.size).toBeGreaterThan(15);
  });

  it("only picks pieces and colours the art has, and every one of them has a sheet", () => {
    for (const [slot, { styles, variants }] of Object.entries(HERO_WARDROBE)) {
      for (const style of styles) {
        for (let variant = 1; variant <= variants; variant++) {
          expect(() =>
            heroSheetUrl(heroSheetPath(slot as HeroSlot, { style, variant })),
          ).not.toThrow();
        }
      }
    }
    // Never the v00 palette template.
    expect(randomHeroAppearance(lowest).body.variant).toBe(1);
    expect(randomHeroAppearance(() => 0.9999).hair.variant).toBe(
      HERO_WARDROBE.hair.variants,
    );
  });

  it("names the sheets as the art does", () => {
    expect(heroSheetPath("body", { style: "humn", variant: 3 })).toBe(
      "char_a_pONE2_0bas_humn_v03.webp",
    );
    expect(heroSheetPath("weapon", { style: "sw01", variant: 5 })).toBe(
      "6tla/char_a_pONE2_6tla_sw01_v05.webp",
    );
  });

  it("leaves some heroes bare-headed", () => {
    expect(randomHeroAppearance(lowest).hat).not.toBeNull();
    expect(randomHeroAppearance(() => 0.9).hat).toBeNull();
    const bareHead = { ...randomHeroAppearance(lowest), hat: null };
    expect(heroLayers(bareHead, "south").map(({ slot }) => slot)).not.toContain("hat");
  });

  it("hides the hair under headwear, which it would stick out of", () => {
    const hatted = randomHeroAppearance(lowest);
    expect(hatted.hat).not.toBeNull();
    for (const facing of FACINGS) {
      expect(heroLayers(hatted, facing).map(({ slot }) => slot)).not.toContain("hair");
      expect(heroLayers({ ...hatted, hat: null }, facing).map(({ slot }) => slot)).toContain(
        "hair",
      );
    }
  });

  it("stacks the clothes over the body, and the weapon and shield as the art's guides say", () => {
    const appearance = randomHeroAppearance(lowest);
    const depthOf = (worn: HeroAppearance, facing: Direction) =>
      Object.fromEntries(heroLayers(worn, facing).map(({ slot, depth }) => [slot, depth]));
    const depth = (facing: Direction) => depthOf(appearance, facing);

    for (const facing of FACINGS) {
      const { body, outfit, hat } = depth(facing);
      expect(body).toBeLessThan(outfit!);
      expect(outfit).toBeLessThan(hat!);
      const { outfit: bareOutfit, hair } = depthOf({ ...appearance, hat: null }, facing);
      expect(bareOutfit).toBeLessThan(hair!);
    }
    const south = depth("south");
    expect(south.hat).toBeLessThan(south.weapon!);
    expect(south.weapon).toBeLessThan(south.shield!);
    const north = depth("north");
    expect(north.shield).toBeLessThan(north.weapon!);
    expect(north.weapon).toBeLessThan(north.body!);
    for (const facing of ["east", "west"] as const) {
      const side = depth(facing);
      expect(side.shield).toBeLessThan(side.body!);
      expect(side.weapon).toBeGreaterThan(side.hat!);
    }
  });

  it("lists the layers in the same order whatever the facing, so the view never reorders them", () => {
    const appearance = randomHeroAppearance(lowest);
    const order = (facing: Direction) =>
      heroLayers(appearance, facing).map(({ slot }) => slot);
    for (const facing of FACINGS) expect(order(facing)).toEqual(order("south"));
  });

  it("turns the hero with the rows of the sheet and keeps every frame inside it", () => {
    expect(new Set(FACINGS.map((facing) => heroSprite("idle", facing).y)).size).toBe(4);
    for (const pose of ["idle", "move"] as const) {
      for (const facing of FACINGS) {
        const sprite = heroSprite(pose, facing);
        expect(
          sprite.x + sprite.pitch * (sprite.frames - 1) + sprite.w,
        ).toBeLessThanOrEqual(HERO_SHEET.width);
        expect(sprite.y + sprite.h).toBeLessThanOrEqual(HERO_SHEET.height);
      }
    }
    expect(heroSprite("idle", "south").x).not.toBe(heroSprite("move", "south").x);
  });

  it("stands the hero on its tile", () => {
    const hero = heroSprite("idle", "south");
    // The middle of the cell, where the hero is drawn, is the middle of the tile.
    expect(hero.dx + hero.w / 2).toBe(8);
    // Its feet (y = 43 in a cell) are near the bottom of the tile.
    expect(hero.dy + 43).toBe(14);
  });
});
