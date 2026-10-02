import { describe, expect, it } from "vitest";
import {
  BOSS,
  ENEMY,
  HERO_SHEET,
  gateSprite,
  heroFacesWest,
  heroSprite,
  itemSprite,
  spriteStyle,
} from "../tiles/sprites";

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

  it("idles on the spot and runs between tiles, on two rows of the sheet", () => {
    const idle = heroSprite("idle");
    const run = heroSprite("run");
    expect(idle.y).not.toBe(run.y);
    expect([idle.frames, run.frames]).toEqual([6, 8]);
    for (const pose of [idle, run]) {
      // Every frame stays inside the sheet.
      expect(pose.x + pose.pitch * (pose.frames - 1) + pose.w).toBeLessThanOrEqual(HERO_SHEET.width);
      expect(pose.y + pose.h).toBeLessThanOrEqual(HERO_SHEET.height);
    }
  });

  it("stands the hero on its tile, centred so that it can be mirrored in place", () => {
    const hero = heroSprite("idle");
    // The middle of the window, where the hero is drawn, is the middle of the tile.
    expect(hero.dx + hero.w / 2).toBe(8);
    // Its feet (y = 34 in a cell) are near the bottom of the tile.
    expect(hero.dy + 34).toBe(14);
  });

  it("mirrors the hero to face west, and keeps its side when going north or south", () => {
    expect(heroFacesWest("west", false)).toBe(true);
    expect(heroFacesWest("east", true)).toBe(false);
    expect(heroFacesWest("north", true)).toBe(true);
    expect(heroFacesWest("south", false)).toBe(false);
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
