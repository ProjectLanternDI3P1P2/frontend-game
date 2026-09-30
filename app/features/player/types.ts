/**
 * Player API contracts consumed by US-PLAYER-07 through US-PLAYER-11.
 *
 * They mirror the JSON returned by Player.Presentation. They are intentionally
 * kept close to the Player capability rather than placed in a global API package.
 */

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
  isEngagedInActiveSession: boolean;
  isSelected: boolean;
  createdAt?: string;
}

export interface CreateHeroRequest {
  name: string;
  classCode: HeroClassCode;
  idempotencyKey: string;
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
}

export type GameSessionState = "Lobby" | "Active" | "Failed" | "Pending";

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
