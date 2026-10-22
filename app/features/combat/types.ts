/**
 * ADR-FE-011 — Hand-written mirror of the Combat service contract (`/api/v1/combats`).
 * When the contract changes, this file changes in the same pull request as
 * `api/combatApi.ts`.
 */

export type FightStatus = "Active" | "Victory" | "Defeat" | "Fled";

export type MonsterClass = "Ordinary" | "SubBoss" | "Boss";

export type FightSide = "Hero" | "Monster";

export type FightActionType = "Attack" | "Ability" | "Item" | "Defend" | "Flee";

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
}

/** POST /api/v1/combats */
export interface StartFightRequest {
  dungeonRunId: string;
  /** A retried request with the same key returns the same fight. */
  idempotencyKey: string;
  /** 1-based. */
  floor: number;
  encounter: MonsterClass;
  heroIds: string[];
  monsterCount?: number;
}

/** POST /api/v1/combats/{fightId}/actions */
export interface FightActionRequest {
  /** Idempotency key of this attempt: a double click is applied once. */
  commandId: string;
  actorId: string;
  type: FightActionType;
  targetId?: string;
  abilityId?: string;
  itemId?: string;
}
