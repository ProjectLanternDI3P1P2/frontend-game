import { describe, expect, it } from "vitest";
import {
  abilityStyle,
  activeHero,
  applyEvent,
  describeEvent,
  gaugesOf,
  groupIntoBeats,
  isHeavyHit,
  targetsFor,
} from "../combatRules";
import type { Combatant, FightEvent, FightResponse } from "../types";

const combatant = (id: string, side: Combatant["side"], hp = 50): Combatant => ({
  combatantId: id,
  side,
  externalId: id,
  name: id,
  level: 1,
  spriteKey: side === "Hero" ? "hero" : "cave-goblin",
  hp,
  maxHp: 50,
  mana: 20,
  maxMana: 20,
  attack: 10,
  defense: 5,
  speed: 5,
  isDefending: false,
  isKnockedOut: hp === 0,
  abilities: [],
  items: [],
});

const fight = (overrides: Partial<FightResponse> = {}): FightResponse => ({
  fightId: "f",
  dungeonRunId: "r",
  status: "Active",
  encounter: "Ordinary",
  floor: 1,
  round: 1,
  turn: 1,
  activeCombatantId: "aldric",
  canFlee: true,
  upcomingTurns: [],
  heroes: [combatant("aldric", "Hero"), combatant("lyra", "Hero", 0)],
  monsters: [combatant("goblin", "Monster"), combatant("bat", "Monster", 0)],
  events: [],
  ...overrides,
});

const event = (overrides: Partial<FightEvent>): FightEvent => ({
  sequence: 1,
  turn: 1,
  type: "Damaged",
  actorId: "goblin",
  targetId: "aldric",
  amount: 12,
  label: null,
  isCritical: false,
  ...overrides,
});

describe("activeHero", () => {
  it("is the hero whose turn it is", () => {
    expect(activeHero(fight())?.combatantId).toBe("aldric");
  });

  it("is nobody once the fight is over", () => {
    expect(activeHero(fight({ status: "Victory" }))).toBeUndefined();
  });
});

describe("targetsFor", () => {
  it("offers only the monsters still standing for an attack", () => {
    expect(targetsFor(fight(), { type: "Attack" })?.map((c) => c.combatantId)).toEqual(["goblin"]);
  });

  it("needs no target for an area ability", () => {
    const ability = { abilityId: "a", name: "Frost Nova", manaCost: 5, target: "AllEnemies" as const };
    expect(targetsFor(fight(), { type: "Ability", ability })).toBeNull();
  });

  it("offers the heroes still standing for a heal", () => {
    const ability = { abilityId: "h", name: "Heal", manaCost: 5, target: "SingleAlly" as const };
    expect(targetsFor(fight(), { type: "Ability", ability })?.map((c) => c.combatantId)).toEqual([
      "aldric",
    ]);
  });
});

describe("applyEvent", () => {
  it("lowers the HP of the target of a hit, never below zero", () => {
    const gauges = applyEvent(gaugesOf(fight()), event({ amount: 80 }));
    expect(gauges.aldric!.hp).toBe(0);
  });

  it("spends the mana of the caster of an ability", () => {
    const gauges = applyEvent(
      gaugesOf(fight()),
      event({ type: "AbilityUsed", actorId: "aldric", targetId: "goblin", amount: 5 }),
    );
    expect(gauges.aldric!.mana).toBe(15);
  });
});

describe("describeEvent", () => {
  it("tells who hit whom", () => {
    expect(describeEvent(event({ type: "Attacked" }), (id) => id ?? "")).toBe(
      "goblin attacks aldric.",
    );
  });

  it("keeps the start of a turn silent", () => {
    expect(describeEvent(event({ type: "TurnStarted" }), (id) => id ?? "")).toBeNull();
  });
});

describe("groupIntoBeats", () => {
  it("plays an action together with the hits, heals and knock-outs that follow it", () => {
    const beats = groupIntoBeats([
      event({ sequence: 1, type: "TurnStarted", actorId: "aldric", targetId: null }),
      event({ sequence: 2, type: "Attacked", actorId: "aldric", targetId: "goblin" }),
      event({ sequence: 3, type: "Damaged", actorId: "aldric", targetId: "goblin" }),
      event({ sequence: 4, type: "KnockedOut", actorId: "aldric", targetId: "goblin" }),
      event({ sequence: 5, type: "Victory", actorId: null, targetId: null }),
    ]);

    expect(beats.map((beat) => [beat.head.sequence, beat.effects.map((e) => e.sequence)])).toEqual([
      [1, []],
      [2, [3, 4]],
      [5, []],
    ]);
  });
});

describe("abilityStyle", () => {
  it("knows the abilities of the mock heroes by name, whatever the case", () => {
    expect(abilityStyle("Fireball", "SingleEnemy")).toBe("fireball");
    expect(abilityStyle("FROST NOVA", "AllEnemies")).toBe("frost");
    expect(abilityStyle("Backstab", "SingleEnemy")).toBe("melee");
  });

  it("falls back on what an unknown ability targets", () => {
    expect(abilityStyle("Holy Light", "SingleAlly")).toBe("heal");
    expect(abilityStyle("Stone Skin", "Self")).toBe("shield");
    expect(abilityStyle("Whirlwind", "AllEnemies")).toBe("frost");
    expect(abilityStyle(null, undefined)).toBe("melee");
  });
});

describe("isHeavyHit", () => {
  it("shakes the board from a fifth of the target's health", () => {
    expect(isHeavyHit(20, 100)).toBe(true);
    expect(isHeavyHit(19, 100)).toBe(false);
  });
});
