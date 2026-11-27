import type { RewardRecipient } from "./types";

/** Who plays the receiving hero, as far as the connected player can tell. */
export type RecipientOwner = "you" | "teammate" | "unknown";

export interface RecipientView {
  heroId: string;
  heroName: string;
  owner: RecipientOwner;
}

/**
 * No service exposes player names to the game front, so the receiving player
 * is identified by comparing player IDs with the connected player's ID, which
 * Reward returns once Player has confirmed the participation: "you" or
 * "teammate". Without either ID the recipient keeps a neutral label. Names
 * come from the session heroes.
 */
export function describeRecipient(
  recipient: RewardRecipient,
  heroNames: ReadonlyMap<string, string>,
  viewerPlayerId: string | null,
): RecipientView {
  const owner: RecipientOwner =
    viewerPlayerId === null || recipient.playerId === null
      ? "unknown"
      : recipient.playerId === viewerPlayerId
        ? "you"
        : "teammate";
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
