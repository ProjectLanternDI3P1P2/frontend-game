/**
 * Player API contracts consumed by US-PLAYER-07 through US-PLAYER-11.
 *
 * They mirror the JSON returned by Player.Presentation. They are intentionally
 * kept close to the Player capability rather than placed in a global API package.
 */

import type { HeroAppearance } from "./appearance";

export type { HeroAppearance } from "./appearance";

export type HeroClassCode = "warrior" | "shaman" | "mage";

export const HERO_ROSTER_CAPACITY = 10;

export interface HeroClassOption {
  code: HeroClassCode;
  label: string;
  description: string;
  baseHealth: number;
}

export interface HeroSummary {
  id: string;
  name: string;
  classCode: HeroClassCode;
  level: number;
  maximumHealth: number;
  /** Derived by the backend from `activeSession`: true exactly when it is set. */
  isEngagedInActiveSession: boolean;
  isSelected: boolean;
  createdAt?: string;
  appearance?: HeroAppearance;
  /** Open session holding the hero, if any: a lobby can be closed, a running dungeon cannot. */
  activeSession?: HeroActiveSession | null;
}

/** The open session a hero is engaged in (`Lobby` or `Active`). */
export interface HeroActiveSession {
  id: string;
  state: GameSessionState;
}

/** US-PLAYER-10 — steps of the hero deletion dialog (Figma "Heroes / Deletion"). */
export enum HeroDeletionStep {
  /** Name confirmation; covers the "Confirmation", "Name typed" and "In progress" mockups. */
  CONFIRM = "confirm",
  /** The hero is playing a running dungeon: deletion is refused until the run ends. */
  BLOCKED = "blocked",
}

/** US-PLAYER-10 — `DELETE /players/:playerId/heroes/:heroId` (idempotent). */
export interface DeleteHeroResponse {
  heroId: string;
  deleted: true;
  deletedAt: string;
  /** True when the hero had already been deleted by an earlier request. */
  alreadyDeleted: boolean;
  /** Lobbies closed before the deletion; their members were notified. */
  closedSessionIds: string[];
}

export interface CreateHeroRequest {
  name: string;
  classCode: HeroClassCode;
  idempotencyKey: string;
  /** Optional: the backend applies the default appearance when omitted. */
  appearance?: HeroAppearance;
}

export interface CreateHeroResponse {
  id: string;
  name: string;
  classCode: HeroClassCode;
  level: number;
  maximumHealth: number;
  createdAt: string;
  unlockedSkillCodes: string[];
  alreadyExists: boolean;
  appearance?: HeroAppearance;
}

export interface HeroAttributes {
  strength: number;
  endurance: number;
  agility: number;
  intelligence: number;
}

export interface HeroAbility {
  code: string;
  label: string;
  targetingType: string;
}

export interface HeroSheet {
  id: string;
  name: string;
  classCode: HeroClassCode;
  level: number;
  createdAt: string;
  attributes: HeroAttributes;
  maximumHealth: number;
  abilities: HeroAbility[];
  appearance?: HeroAppearance;
}

/**
 * `Abandoned`: the lobby was closed before its run started, for instance because one of its
 * heroes was deleted (US-PLAYER-10); `failureReason` then names the cause (`HeroDeleted`).
 */
export type GameSessionState = "Lobby" | "Active" | "Failed" | "Pending" | "Abandoned";

export interface SessionHero {
  id: string;
  name: string;
  classCode: HeroClassCode;
  level: number;
}

/** Authoritative snapshot sent by PlayerHub after a gameplay command. */
export interface GameSessionSnapshot {
  sessionId: string;
  creatorPlayerId: string;
  state: GameSessionState;
  mode: string;
  members: SessionHero[];
  dungeonRunId: string | null;
  dungeonSeed: string | null;
  failureReason: string | null;
  alreadyExists: boolean;
}
