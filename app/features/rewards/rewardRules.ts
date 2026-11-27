import type { RewardRecipient } from "./types";

/** Who plays the receiving hero, as far as the connected player can tell. */
export type RecipientOwner = "you" | "teammate" | "unknown";

export interface RecipientView {
  heroId: string;
  heroName: string;
  owner: RecipientOwner;
}

/**
 * Reward only returns identifiers and no service exposes player names to the
 * game front, so the receiving player is identified through their hero: one of
 * the connected player's heroes ("you") or another hero of the session
 * ("teammate"). Without the player's heroes, or for a hero outside the session,
 * the recipient keeps a neutral label.
 */
export function describeRecipient(
  recipient: RewardRecipient,
  heroNames: ReadonlyMap<string, string>,
  ownHeroIds: ReadonlySet<string> | null,
): RecipientView {
  const owner: RecipientOwner =
    ownHeroIds === null
      ? "unknown"
      : ownHeroIds.has(recipient.heroId)
        ? "you"
        : heroNames.has(recipient.heroId)
          ? "teammate"
          : "unknown";
  return {
    heroId: recipient.heroId,
    heroName: heroNames.get(recipient.heroId) ?? "Unknown hero",
    owner,
  };
}

/** Rarity casing is not guaranteed by the API. */
export function normalizeRarity(rarity: string): string {
  return rarity.trim().toLowerCase();
}
