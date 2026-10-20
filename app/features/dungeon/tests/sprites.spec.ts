import { describe, expect, it } from "vitest";
import { mobClassName, BOSS, ENEMY, gateSprite, itemSprite, spriteStyle } from "../tiles/sprites";

describe("sprites", () => {
  it("only uses chests for items", () => {
    expect(new Set([0, 1, 2, 3, 4, 5].map((id) => itemSprite(id).x))).toEqual(new Set([0]));
    expect(new Set([0, 1, 2].map((id) => itemSprite(id).y))).toEqual(new Set([64, 96, 128]));
  });

  it("gives a chest the same look every time: it depends on its id only", () => {
    expect(itemSprite(3)).toEqual(itemSprite(3));
  });

  it("draws every enemy, the boss included, with the placeholder mob, floating above its tile", () => {
    expect(ENEMY.sheet).toBe("mob");
    expect(BOSS.sheet).toBe("mob");
    expect(ENEMY.frames).toBe(1);
    // Its bottom stands above the bottom of its tile: it hovers.
    expect(ENEMY.dy + ENEMY.h * ENEMY.scale!).toBeLessThan(16);
    expect(BOSS.dy + BOSS.h * BOSS.scale!).toBeLessThan(16);
    // Centred on its tile; an enemy about the size of the hero, the boss much bigger.
    expect(ENEMY.dx + (ENEMY.w * ENEMY.scale!) / 2).toBe(8);
    expect(ENEMY.w * ENEMY.scale!).toBeLessThanOrEqual(24);
    expect(BOSS.dx + (BOSS.w * BOSS.scale!) / 2).toBe(8);
  });

  it("draws the boss larger than the other enemies", () => {
    expect(BOSS.scale).toBeGreaterThan(1);
  });

  it("uses the portcullis of each theme", () => {
    expect(gateSprite("violet").y).not.toBe(gateSprite("stone").y);
  });

  it("describes a sprite with custom properties only", () => {
    const style = spriteStyle(ENEMY, { x: 4, y: 9 });
    expect(style).toContain("--x:4;--y:9;");
    expect(style).toMatch(/^(--[a-z]+:-?[\d.]+s?;?)+$/);
  });
});

describe("mobClassName", () => {
  it("lights up a mob once it is in aggro", () => {
    const mob = { id: 4, kind: "bat", x: 1, y: 2, aggro: false, nextTeleport: null } as const;

    expect(mobClassName(mob)).not.toContain("dungeon-mob--aggro");
    expect(mobClassName({ ...mob, aggro: true })).toContain("dungeon-mob--aggro");
    expect(mobClassName(mob)).toContain("dungeon-element--bat");
  });
});
