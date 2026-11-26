/**
 * ADR-FE-011 — Hand-written mirror of the Combat service contract. The gameplay goes
 * through the Combat Hub (`/hubs/combats`, ADR-GLOB-010): `api/combatHub.ts` maps its
 * snapshot (`CombatSnapshotWire`) to the screen model (`FightResponse`). When the
 * contract changes, this file changes in the same pull request as `api/combatHub.ts`.
 */
import type { HeroAppearance } from "~/features/player/appearance";

export type FightStatus = "Active" | "Victory" | "Defeat" | "Fled";

export type MonsterClass = "Ordinary" | "SubBoss" | "Boss";

export type FightSide = "Hero" | "Monster";

export type FightActionType =
  | "Attack"
  | "Ability"
  | "Item"
  | "Defend"
  | "Flee"
  | "Pass";

export type AbilityTarget = "SingleEnemy" | "AllEnemies" | "SingleAlly" | "Self";

export type ItemEffect = "RestoreHealth" | "RestoreMana";

export type FightEventType =
  | "TurnStarted"
  | "Attacked"
  | "AbilityUsed"
  | "ItemUsed"
  | "Damaged"
  /** The target sidestepped the blow: no damage. */
  | "Missed"
  | "Healed"
  | "ManaRestored"
  | "Defended"
  | "FleeFailed"
  /** The hero passed its turn. */
  | "Passed"
  /** The hero did not act before the deadline: the server passed the turn. */
  | "TurnTimedOut"
  | "Fled"
  | "KnockedOut"
  | "Victory"
  | "Defeat";

export interface Ability {
  abilityId: string;
  name: string;
  manaCost: number;
  target: AbilityTarget;
}

export interface CombatItem {
  itemId: string;
  name: string;
  effect: ItemEffect;
  amount: number;
  quantity: number;
}

export interface Combatant {
  combatantId: string;
  side: FightSide;
  /** Hero id in Player, or monster definition id in Combat. */
  externalId: string;
  name: string;
  level: number;
  /** Which sprite to draw: "hero", "cave-goblin"... */
  spriteKey: string;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  attack: number;
  defense: number;
  speed: number;
  isDefending: boolean;
  isKnockedOut: boolean;
  abilities: Ability[];
  items: CombatItem[];
  /** Codes to draw the fighter with: a hero carries the Player class and appearance. */
  visual: CombatVisual;
}

/** Codes only, never an image: the Player catalogue turns a hero's codes into its sprite. */
export interface CombatVisual {
  kind: "hero" | "monster";
  classCode: string | null;
  /** Absent when Player did not send it: `HeroSprite` then applies its default. */
  appearance: HeroAppearance | null;
  spriteKey: string | null;
  isBoss: boolean;
}

/** One resolved fact; the client replays them in `sequence` order. */
export interface FightEvent {
  sequence: number;
  turn: number;
  type: FightEventType;
  actorId: string | null;
  targetId: string | null;
  /** HP or mana changed (mana spent for `AbilityUsed`), 0 otherwise. */
  amount: number;
  /** Ability or item name. */
  label: string | null;
  /** A critical hit (damage x 1.5). */
  isCritical: boolean;
}

/**
 * Every fight endpoint returns this. `events` is the whole log for GET and POST /combats,
 * and only the events of the action for POST /combats/{id}/actions.
 */
export interface FightResponse {
  fightId: string;
  dungeonRunId: string;
  status: FightStatus;
  encounter: MonsterClass;
  floor: number;
  round: number;
  turn: number;
  activeCombatantId: string | null;
  canFlee: boolean;
  /** Rest of the current round, active combatant first. */
  upcomingTurns: string[];
  heroes: Combatant[];
  monsters: Combatant[];
  events: FightEvent[];
  encounterId: string;
  /** Server deadline of the hero's turn (UTC ISO): the server clock decides. */
  deadlineUtc: string | null;
  timeMaxSeconds: number;
}

/** A hero's action, sent to `SubmitAction` / `PassTurn` on the Combat Hub. */
export interface FightActionRequest {
  /** Idempotency key of this attempt: a double click is applied once. */
  commandId: string;
  actorId: string;
  type: FightActionType;
  targetId?: string;
  /** Code of the ability, e.g. "warrior-strike". */
  abilityId?: string;
  itemId?: string;
}

// ---- Wire format of the Combat Hub (camelCase JSON of CombatSnapshotDto) ----------------

export interface CombatSnapshotWire {
  id: string;
  runId: string;
  encounterId: string;
  trigger: "collision" | "boss";
  status: "active" | "finished";
  result: "victory" | "defeat" | "fled" | null;
  canFlee: boolean;
  floor: number;
  turn: {
    number: number;
    round: number;
    actorId: string;
    deadlineUtc: string | null;
    timeMaxSeconds: number;
  } | null;
  upcomingTurns: string[];
  fighters: CombatFighterWire[];
  log: CombatEventWire[];
}

export interface CombatFighterWire {
  id: string;
  side: "hero" | "monster";
  externalId: string;
  name: string;
  level: number;
  currentHp: number;
  maxHp: number;
  currentMana: number;
  maxMana: number;
  attack: number;
  defense: number;
  speed: number;
  state: "active" | "outOfCombat";
  isDefending: boolean;
  abilities: {
    code: string;
    name: string;
    manaCost: number;
    targetType: AbilityTarget;
    power: number;
  }[];
  visual: {
    kind: "hero" | "monster";
    classCode: string | null;
    appearance: {
      skinTone: number;
      hairStyle: string;
      hairColor: number | null;
    } | null;
    spriteKey: string | null;
    isBoss: boolean;
  };
}

export interface CombatEventWire {
  sequence: number;
  turn: number;
  type: string;
  actorId: string | null;
  targetId: string | null;
  amount: number;
  label: string | null;
  isCritical: boolean;
}

export interface CombatCommandResultWire {
  commandId: string | null;
  accepted: boolean;
  error: { code: string; message: string } | null;
  snapshot: CombatSnapshotWire | null;
  events: CombatEventWire[];
}
