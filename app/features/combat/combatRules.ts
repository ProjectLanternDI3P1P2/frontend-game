/**
 * Pure helpers of the combat screen. The service resolves every outcome (ADR-FE-008): the
 * client only chooses an action, then replays the events it gets back.
 */
import type {
  Ability,
  Combatant,
  CombatItem,
  FightEvent,
  FightResponse,
  FightStatus,
} from "./types";

/** What the player is choosing in the command panel. */
export type CommandStep =
  | { kind: "root" }
  | { kind: "fight" }
  | { kind: "items" }
  | { kind: "target"; action: PendingAction };

/** An action waiting for its target. */
export type PendingAction =
  | { type: "Attack" }
  | { type: "Ability"; ability: Ability }
  | { type: "Item"; item: CombatItem };

/** HP and mana as shown on screen, which lag behind the service while events replay. */
export interface Gauges {
  hp: number;
  mana: number;
}

export function allCombatants(fight: FightResponse): Combatant[] {
  return [...fight.heroes, ...fight.monsters];
}

export function findCombatant(fight: FightResponse, id: string | null): Combatant | undefined {
  return id ? allCombatants(fight).find((c) => c.combatantId === id) : undefined;
}

/** The hero whose turn it is, if a hero must act. */
export function activeHero(fight: FightResponse): Combatant | undefined {
  if (fight.status !== "Active") return undefined;
  return fight.heroes.find((hero) => hero.combatantId === fight.activeCombatantId);
}

/**
 * Who can be picked for an action: monsters for an attack, heroes for a heal or a potion.
 * Null when the action needs no target (area, self).
 */
export function targetsFor(fight: FightResponse, action: PendingAction): Combatant[] | null {
  const standing = (list: Combatant[]) => list.filter((c) => !c.isKnockedOut);
  switch (action.type) {
    case "Attack":
      return standing(fight.monsters);
    case "Item":
      return standing(fight.heroes);
    case "Ability":
      switch (action.ability.target) {
        case "SingleEnemy":
          return standing(fight.monsters);
        case "SingleAlly":
          return standing(fight.heroes);
        default:
          return null;
      }
  }
}

export function canAfford(hero: Combatant, ability: Ability): boolean {
  return hero.mana >= ability.manaCost;
}

export function usableItems(hero: Combatant): CombatItem[] {
  return hero.items.filter((item) => item.quantity > 0);
}

export function gaugesOf(fight: FightResponse): Record<string, Gauges> {
  return Object.fromEntries(
    allCombatants(fight).map((c) => [c.combatantId, { hp: c.hp, mana: c.mana }]),
  );
}

/** Moves the displayed gauges by one event. Returns a new record. */
export function applyEvent(
  gauges: Record<string, Gauges>,
  event: FightEvent,
): Record<string, Gauges> {
  const next = { ...gauges };
  const change = (id: string | null, hp: number, mana: number) => {
    if (!id || !next[id]) return;
    next[id] = { hp: Math.max(0, next[id].hp + hp), mana: Math.max(0, next[id].mana + mana) };
  };
  switch (event.type) {
    case "Damaged":
      change(event.targetId, -event.amount, 0);
      break;
    case "Healed":
      change(event.targetId, event.amount, 0);
      break;
    case "ManaRestored":
      change(event.targetId, 0, event.amount);
      break;
    case "AbilityUsed":
      change(event.actorId, 0, -event.amount);
      break;
  }
  return next;
}

/** A sentence for the battle log and the screen reader; null for silent events. */
export function describeEvent(
  event: FightEvent,
  nameOf: (id: string | null) => string,
): string | null {
  const actor = nameOf(event.actorId);
  const target = nameOf(event.targetId);
  switch (event.type) {
    case "TurnStarted":
      return null;
    case "Attacked":
      return `${actor} attacks ${target}.`;
    case "AbilityUsed":
      return event.targetId && event.targetId !== event.actorId
        ? `${actor} casts ${event.label} on ${target}.`
        : `${actor} casts ${event.label}.`;
    case "ItemUsed":
      return event.targetId === event.actorId
        ? `${actor} drinks a ${event.label}.`
        : `${actor} gives a ${event.label} to ${target}.`;
    case "Damaged":
      return event.isCritical
        ? `Critical hit! ${target} loses ${event.amount} HP.`
        : `${target} loses ${event.amount} HP.`;
    case "Missed":
      return `${target} dodges!`;
    case "Healed":
      return `${target} recovers ${event.amount} HP.`;
    case "ManaRestored":
      return `${target} recovers ${event.amount} mana.`;
    case "Defended":
      return `${actor} stands on guard.`;
    case "FleeFailed":
      return `${actor} tries to run away… but fails!`;
    case "Fled":
      return "The party runs away!";
    case "KnockedOut":
      return `${target} is knocked out!`;
    case "Victory":
      return "Victory!";
    case "Defeat":
      return "The party has fallen…";
  }
}

export function outcomeTitle(status: FightStatus): string {
  switch (status) {
    case "Victory":
      return "Victory!";
    case "Defeat":
      return "Defeat…";
    case "Fled":
      return "Escaped";
    default:
      return "";
  }
}

// --- Staging -------------------------------------------------------------------------------

/**
 * One beat of the replay: an action (or a turn start, or the end of the fight) and the
 * consequences that follow it — hits, heals, knock-outs. The screen plays a beat as one
 * choreography: the attacker runs in, strikes, the targets react, the attacker goes back.
 */
export interface Beat {
  head: FightEvent;
  effects: FightEvent[];
}

const CONSEQUENCES: ReadonlySet<FightEvent["type"]> = new Set([
  "Damaged",
  "Missed",
  "Healed",
  "ManaRestored",
  "KnockedOut",
]);

export function groupIntoBeats(events: readonly FightEvent[]): Beat[] {
  const beats: Beat[] = [];
  for (const event of events) {
    const current = beats.at(-1);
    if (CONSEQUENCES.has(event.type) && current) current.effects.push(event);
    else beats.push({ head: event, effects: [] });
  }
  return beats;
}

/** How an ability looks on screen. */
export type AbilityStyle = "melee" | "fireball" | "frost" | "heal" | "shield";

/** Known abilities by name; the others by what they target. */
const ABILITY_STYLES: Readonly<Record<string, AbilityStyle>> = {
  fireball: "fireball",
  "frost nova": "frost",
  heal: "heal",
  "shield wall": "shield",
  "heavy strike": "melee",
  backstab: "melee",
};

export function abilityStyle(name: string | null, target: Ability["target"] | undefined): AbilityStyle {
  const known = name ? ABILITY_STYLES[name.toLowerCase()] : undefined;
  if (known) return known;
  switch (target) {
    case "AllEnemies":
      return "frost";
    case "SingleAlly":
      return "heal";
    case "Self":
      return "shield";
    default:
      return "melee";
  }
}

/** A hit worth shaking the screen: a fifth of the target's health or more. */
export function isHeavyHit(amount: number, maxHp: number): boolean {
  return maxHp > 0 && amount * 5 >= maxHp;
}

/** Colour of each party slot in the panel, as in the art team's mock-up. */
export const PARTY_TONES = ["red", "yellow", "grey", "blue"] as const;
export type PartyTone = (typeof PARTY_TONES)[number];

export function partyTone(index: number): PartyTone {
  return PARTY_TONES[index % PARTY_TONES.length]!;
}
