import { describe, expect, it } from "vitest";
import { HERO_SLOTS, heroSheetUrl } from "~/features/player/appearance";
import {
  HERO_SHEET,
  HERO_STANCES,
  HERO_WARDROBES,
  heroAppearanceOf,
  heroLayers,
  heroSprite,
  randomHeroAppearance,
  type HeroAppearance,
  type HeroStance,
} from "../tiles/hero";
import type { Direction } from "../types";

const FACINGS: Direction[] = ["south", "north", "east", "west"];

/** Always draws the same number: the first fighting style, piece and colour of every slot. */
const lowest = () => 0;

/** A hero of a fighting style, in the first piece and colour of every slot, hat on. */
function heroOf(stance: HeroStance): HeroAppearance {
  let first = true;
  return randomHeroAppearance(() => {
    if (!first) return 0;
    first = false;
    return HERO_STANCES.indexOf(stance) / HERO_STANCES.length;
  });
}

const runIds = Array.from(
  { length: 200 },
  (_, index) => `0199a5b2-0000-7000-8000-${String(index).padStart(12, "0")}`,
);

describe("hero", () => {
  it("draws the same hero for a run every time, and others for other runs", () => {
    const runId = "0199a5b2-0000-7000-8000-000000000001";
    expect(heroAppearanceOf(runId)).toEqual(heroAppearanceOf(runId));

    const looks = new Set(
      runIds.slice(0, 20).map((runId) => JSON.stringify(heroAppearanceOf(runId))),
    );
    expect(looks.size).toBeGreaterThan(15);
  });

  it("dresses every slot from the page of its fighting style, in pieces and colours it has", () => {
    const looks = [randomHeroAppearance(lowest), randomHeroAppearance(() => 0.9999)];
    for (const look of [...looks, ...runIds.map(heroAppearanceOf)]) {
      for (const slot of HERO_SLOTS) {
        const piece = look[slot];
        if (!piece) continue;
        expect(Object.keys(HERO_WARDROBES[look.stance][slot] ?? {})).toContain(piece.style);
        expect(() => heroSheetUrl(look.stance, slot, piece)).not.toThrow();
      }
    }
    // Never the v00 palette template.
    expect(randomHeroAppearance(lowest).body.variant).toBe(1);
    const last = randomHeroAppearance(() => 0.9999);
    expect(last.hair.variant).toBe(HERO_WARDROBES[last.stance].hair[last.hair.style]);
  });

  it("fights with a sword, a bow and a quiver, or a polearm in both hands", () => {
    const stances = new Set(runIds.map((runId) => heroAppearanceOf(runId).stance));
    expect([...stances].sort()).toEqual([...HERO_STANCES].sort());

    expect(heroOf("pONE2").shield?.style).toMatch(/^sh/);
    expect(heroOf("pBOW2").weapon.style).toMatch(/^bo/);
    expect(heroOf("pBOW2").shield?.style).toBe("qv01");
    expect(heroOf("pPOL2").shield).toBeNull();
    expect(heroLayers(heroOf("pPOL2"), "south").map(({ slot }) => slot)).not.toContain("shield");
  });

  it("holds a wand with or without a shield, and every other one-handed weapon with one", () => {
    const oneHanded = Array.from({ length: 1000 }, (_, index) =>
      heroAppearanceOf(`wand-${index}`),
    ).filter(({ stance }) => stance === "pONE2");
    const wands = oneHanded.filter(({ weapon }) => weapon.style === "wand");
    expect(wands.some(({ shield }) => shield === null)).toBe(true);
    expect(wands.some(({ shield }) => shield !== null)).toBe(true);
    for (const { weapon, shield } of oneHanded) {
      if (weapon.style !== "wand") expect(shield).not.toBeNull();
    }
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

  it("puts the bow in front facing south only, and the quiver on the back in front facing north only", () => {
    const depth = (facing: Direction) =>
      Object.fromEntries(heroLayers(heroOf("pBOW2"), facing).map(({ slot, depth }) => [slot, depth]));
    expect(depth("south").weapon).toBeGreaterThan(depth("south").hat!);
    expect(depth("south").shield).toBeLessThan(depth("south").body!);
    expect(depth("north").weapon).toBeLessThan(depth("north").body!);
    expect(depth("north").shield).toBeGreaterThan(depth("north").hat!);
    for (const facing of ["east", "west"] as const) {
      expect(depth(facing).weapon).toBeLessThan(depth(facing).body!);
      expect(depth(facing).shield).toBeLessThan(depth(facing).body!);
    }
  });

  it("holds the polearm behind facing north, in front otherwise", () => {
    const depth = (facing: Direction) =>
      Object.fromEntries(heroLayers(heroOf("pPOL2"), facing).map(({ slot, depth }) => [slot, depth]));
    expect(depth("north").weapon).toBeLessThan(depth("north").body!);
    for (const facing of ["south", "east", "west"] as const) {
      expect(depth(facing).weapon).toBeGreaterThan(depth(facing).hat!);
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
