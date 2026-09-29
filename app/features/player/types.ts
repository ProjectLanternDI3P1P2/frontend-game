/**
 * Player API contracts consumed by US-PLAYER-07 through US-PLAYER-11.
 *
 * They mirror the JSON returned by Player.Presentation. They are intentionally
 * kept close to the Player capability rather than placed in a global API package.
 */

export type HeroClassCode = "warrior" | "shaman" | "mage";

export interface HeroClassOption {
  code: HeroClassCode;
  label: string;
  baseHealth: number;
}

/** The three server-supported classes (US-PLAYER-07). */
export const HERO_CLASS_OPTIONS: readonly HeroClassOption[] = [
  { code: "warrior", label: "Warrior", baseHealth: 60 },
  { code: "shaman", label: "Shaman", baseHealth: 50 },
  { code: "mage", label: "Mage", baseHealth: 45 },
];

export interface HeroSummary {
  id: string;
  name: string;
  classCode: HeroClassCode;
  level: number;
  maximumHealth: number;
  isEngagedInActiveSession: boolean;
  createdAt: string;
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
  attributes: HeroAttributes;
  maximumHealth: number;
  abilities: HeroAbility[];
}

export interface StartSoloRunRequest {
  idempotencyKey: string;
}

export type GameSessionState = "Active" | "Failed" | "Pending";

export interface SessionHero {
  id: string;
  name: string;
  classCode: HeroClassCode;
  level: number;
}

export interface StartSoloRunResponse {
  sessionId: string;
  hero: SessionHero;
  state: GameSessionState;
  dungeonRunId: string | null;
  dungeonSeed: string | null;
  failureReason: string | null;
  alreadyExists: boolean;
}
