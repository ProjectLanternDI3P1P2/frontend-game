import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, type EffectScope } from "vue";
import { flushPromises } from "@vue/test-utils";
import * as api from "../api/combatApi";
import { useCombat } from "../composables/useCombat";
import type { Combatant, FightResponse } from "../types";

vi.mock("../api/combatApi", () => ({
  fetchFight: vi.fn(),
  submitFightAction: vi.fn(),
  onFightChanged: vi.fn(),
  leaveCombat: vi.fn(),
}));

const combatant = (id: string, side: Combatant["side"], hp = 50): Combatant => ({
  combatantId: id,
  side,
  externalId: id,
  name: id,
  level: 1,
  spriteKey: side === "Hero" ? "hero" : "cave-goblin",
  hp,
  maxHp: 50,
  mana: 10,
  maxMana: 10,
  attack: 10,
  defense: 5,
  speed: 5,
  isDefending: false,
  isKnockedOut: hp === 0,
  abilities: [],
  items: [],
  visual: {
    kind: side === "Hero" ? "hero" : "monster",
    classCode: null,
    appearance: null,
    spriteKey: null,
    isBoss: false,
  },
});

const fight = (overrides: Partial<FightResponse> = {}): FightResponse => ({
  fightId: "f",
  dungeonRunId: "r",
  encounterId: "e",
  status: "Active",
  encounter: "Ordinary",
  floor: 1,
  round: 1,
  turn: 1,
  activeCombatantId: "aldric",
  canFlee: true,
  upcomingTurns: [],
  heroes: [combatant("aldric", "Hero")],
  monsters: [combatant("goblin", "Monster")],
  events: [],
  deadlineUtc: null,
  timeMaxSeconds: 30,
  ...overrides,
});

describe("useCombat", () => {
  let scope: EffectScope;
  let pushed: ((state: FightResponse) => void) | null;

  beforeEach(() => {
    pushed = null;
    vi.mocked(api.onFightChanged).mockImplementation((listener) => {
      pushed = listener;
    });
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
    vi.clearAllMocks();
  });

  it("applies the state pushed during a replay once the replay is over", async () => {
    vi.mocked(api.fetchFight).mockResolvedValue(fight());
    const combat = scope.run(() => useCombat("f"))!;
    await combat.start();

    // The answer of our action arrives at turn 2; a later push (turn 3, the monsters
    // played again after another client's action) lands while the action is in flight.
    let answer!: (state: FightResponse) => void;
    vi.mocked(api.submitFightAction).mockReturnValue(
      new Promise((resolve) => (answer = resolve)),
    );
    const action = combat.defend();
    await flushPromises();
    pushed!(fight({ turn: 3, round: 2 }));
    answer(fight({ turn: 2 }));
    await action;

    expect(combat.fight.value?.turn).toBe(3);
  });

  it("ignores a push that is not newer than the answer", async () => {
    vi.mocked(api.fetchFight).mockResolvedValue(fight());
    const combat = scope.run(() => useCombat("f"))!;
    await combat.start();

    let answer!: (state: FightResponse) => void;
    vi.mocked(api.submitFightAction).mockReturnValue(
      new Promise((resolve) => (answer = resolve)),
    );
    const action = combat.defend();
    await flushPromises();
    pushed!(fight({ turn: 2 }));
    answer(fight({ turn: 2, round: 5 }));
    await action;

    expect(combat.fight.value?.round).toBe(5);
  });

  it("shows a push received while idle at once", async () => {
    vi.mocked(api.fetchFight).mockResolvedValue(fight());
    const combat = scope.run(() => useCombat("f"))!;
    await combat.start();

    pushed!(fight({ turn: 4, status: "Victory", activeCombatantId: null }));

    expect(combat.fight.value?.status).toBe("Victory");
  });
});
