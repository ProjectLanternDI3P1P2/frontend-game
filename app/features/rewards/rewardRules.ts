import type { RewardRecipient } from "./types";

/** Who plays the receiving hero, as far as the connected player can tell. */
export type RecipientOwner = "you" | "teammate" | "unknown";

export interface RecipientView {
  heroId: string;
  heroName: string;
  owner: RecipientOwner;
  /** True when the recipient belongs to the connected player. */
  isYou: boolean;
}

/**
 * Reward only returns identifiers and no service exposes player names to the
 * game front, so the receiving player is identified through their hero in the
 * session: the connected player ("you") or another participant ("teammate").
 * A recipient whose hero is not in the session keeps a neutral label.
 */
export function describeRecipient(
  recipient: RewardRecipient,
  heroNames: ReadonlyMap<string, string>,
  currentPlayerId: string | null,
): RecipientView {
  const owner: RecipientOwner =
    recipient.playerId === null || currentPlayerId === null
      ? "unknown"
      : recipient.playerId === currentPlayerId
        ? "you"
        : "teammate";
  return {
    heroId: recipient.heroId,
    heroName: heroNames.get(recipient.heroId) ?? "Unknown hero",
    owner,
    isYou: owner === "you",
  };
}

/** Rarity casing is not guaranteed by the API. */
export function normalizeRarity(rarity: string): string {
  return rarity.trim().toLowerCase();
}
