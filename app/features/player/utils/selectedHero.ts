import type { HeroSummary } from "../types";

/**
 * Resolves the hero explicitly selected in the player roster.
 */
export function findSelectedHeroId(heroes: HeroSummary[]): string | null {
  return heroes.find((hero) => hero.isSelected)?.id ?? null;
}
