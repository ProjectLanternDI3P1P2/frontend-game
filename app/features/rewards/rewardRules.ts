import type { RewardRecipient } from "./types";

export interface RecipientView {
  heroId: string;
  heroName: string;
  /** True when the recipient belongs to the connected player. */
  isYou: boolean;
}

/**
 * Reward only returns identifiers, so names come from the session members.
 * A recipient whose hero is not in the session keeps a neutral label.
 */
export function describeRecipient(
  recipient: RewardRecipient,
  heroNames: ReadonlyMap<string, string>,
  currentPlayerId: string,
): RecipientView {
  return {
    heroId: recipient.heroId,
    heroName: heroNames.get(recipient.heroId) ?? "Unknown hero",
    isYou: recipient.playerId === currentPlayerId,
  };
}

/** Rarity casing is not guaranteed by the API. */
export function normalizeRarity(rarity: string): string {
  return rarity.trim().toLowerCase();
}
