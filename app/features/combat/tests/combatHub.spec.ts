import { describe, expect, it } from "vitest";
import { toFight } from "../api/combatHub";
import type { CombatEventWire, CombatSnapshotWire } from "../types";

const snapshot = (overrides: Partial<CombatSnapshotWire> = {}): CombatSnapshotWire => ({
  id: "combat-1",
  runId: "run-1",
  encounterId: "enc-1",
  trigger: "collision",
  status: "active",
  result: null,
  canFlee: true,
  floor: 2,
  turn: {
    number: 3,
    round: 2,
    actorId: "hero-f",
    deadlineUtc: "2026-11-26T10:00:30Z",
    timeMaxSeconds: 30,
  },
  upcomingTurns: ["hero-f", "m1"],
  fighters: [
    {
      id: "hero-f",
      side: "hero",
      externalId: "hero-1",
      name: "Aldric",
      level: 2,
      currentHp: 120,
      maxHp: 156,
      currentMana: 17,
      maxMana: 21,
      attack: 18,
      defense: 8,
      speed: 9,
      state: "active",
      isDefending: false,
      abilities: [
        {
          code: "warrior-strike",
          name: "Strike",
          manaCost: 4,
          targetType: "SingleEnemy",
          power: 150,
        },
      ],
      visual: {
        kind: "hero",
        classCode: "warrior",
        appearance: { skinTone: 3, hairStyle: "bob1", hairColor: 5 },
        spriteKey: null,
        isBoss: false,
      },
    },
    ...["m1", "m2", "m3"].map((id) => ({
      id,
      side: "monster" as const,
      externalId: `mob-${id}`,
      name: "Cave Goblin",
      level: 2,
      currentHp: id === "m3" ? 0 : 24,
      maxHp: 24,
      currentMana: 0,
      maxMana: 0,
      attack: 14,
      defense: 8,
      speed: 11,
      state: id === "m3" ? ("outOfCombat" as const) : ("active" as const),
      isDefending: false,
      abilities: [],
      visual: {
        kind: "monster" as const,
        classCode: null,
        appearance: null,
        spriteKey: "cave-goblin",
        isBoss: false,
      },
    })),
  ],
  log: [],
  ...overrides,
});

describe("toFight", () => {
  it("maps a pack of three monsters and the hero with its Player codes", () => {
    const fight = toFight(snapshot(), []);

    expect(fight.fightId).toBe("combat-1");
    expect(fight.dungeonRunId).toBe("run-1");
    expect(fight.floor).toBe(2);
    expect(fight.activeCombatantId).toBe("hero-f");
    expect(fight.deadlineUtc).toBe("2026-11-26T10:00:30Z");
    expect(fight.heroes).toHaveLength(1);
    expect(fight.monsters).toHaveLength(3);
    expect(fight.monsters[2]?.isKnockedOut).toBe(true);
    expect(fight.monsters[0]?.spriteKey).toBe("cave-goblin");
    expect(fight.heroes[0]?.visual).toEqual({
      kind: "hero",
      classCode: "warrior",
      appearance: { skinTone: 3, hairStyle: "bob1", hairColor: 5 },
      spriteKey: null,
      isBoss: false,
    });
    expect(fight.heroes[0]?.abilities[0]).toEqual({
      abilityId: "warrior-strike",
      name: "Strike",
      manaCost: 4,
      target: "SingleEnemy",
    });
  });

  it.each([
    ["victory", "Victory"],
    ["defeat", "Defeat"],
    ["fled", "Fled"],
  ] as const)("maps a finished %s", (result, status) => {
    const fight = toFight(snapshot({ status: "finished", result, turn: null }), []);

    expect(fight.status).toBe(status);
    expect(fight.activeCombatantId).toBeNull();
    expect(fight.deadlineUtc).toBeNull();
  });

  it("keeps the server's current resources, including zero mana", () => {
    const start = snapshot();
    const fight = toFight(
      {
        ...start,
        fighters: start.fighters.map((fighter) =>
          fighter.id === "hero-f"
            ? { ...fighter, currentHp: 42, currentMana: 0 }
            : fighter,
        ),
      },
      [],
    );

    expect(fight.heroes[0]).toMatchObject({ hp: 42, maxHp: 156, mana: 0, maxMana: 21 });
  });

  it("maps a boss fight", () => {
    expect(toFight(snapshot({ trigger: "boss", canFlee: false }), []).encounter).toBe(
      "Boss",
    );
  });

  it("turns camelCase event types into the screen's event types", () => {
    const events: CombatEventWire[] = [
      {
        sequence: 1,
        turn: 3,
        type: "knockedOut",
        actorId: "hero-f",
        targetId: "m3",
        amount: 0,
        label: null,
        isCritical: false,
      },
      {
        sequence: 2,
        turn: 4,
        type: "turnTimedOut",
        actorId: "hero-f",
        targetId: null,
        amount: 0,
        label: null,
        isCritical: false,
      },
    ];

    expect(toFight(snapshot(), events).events.map((event) => event.type)).toEqual([
      "KnockedOut",
      "TurnTimedOut",
    ]);
  });

  it("drops an event type the screen does not know instead of staging it", () => {
    const events: CombatEventWire[] = [
      {
        sequence: 1,
        turn: 3,
        type: "attacked",
        actorId: "hero-f",
        targetId: "m1",
        amount: 0,
        label: null,
        isCritical: false,
      },
      {
        sequence: 2,
        turn: 3,
        type: "somethingNew",
        actorId: "hero-f",
        targetId: null,
        amount: 0,
        label: null,
        isCritical: false,
      },
    ];

    expect(toFight(snapshot(), events).events.map((event) => event.type)).toEqual([
      "Attacked",
    ]);
  });
});
