/**
 * A seed as players share it: 13 Crockford base32 characters, grouped as
 * "0KX4-M2T9-QZ7PA". Mirrors Dungeon's Seed.TryParse so that a malformed seed
 * is caught while typing instead of coming back as a 422.
 */
/** Reserved by Dungeon for the debug sandbox: two bare rooms where mobs are spawned by hand. */
export const SANDBOX_SEED = "0000000SANDBX";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const SEED_LENGTH = 13;
// 13 characters carry 65 bits: the first one only holds the 4 highest bits (0–F).
const MAXIMUM_FIRST_CHARACTER_VALUE = 15;

/** Keeps the seed characters of what was typed or pasted, grouped with dashes. */
export function formatSeed(text: string): string {
  const characters = [...text.toUpperCase()]
    // Crockford decoding: the letters a human confuses map to the digit they look like.
    .map((character) =>
      character === "O"
        ? "0"
        : character === "I" || character === "L"
          ? "1"
          : character,
    )
    .filter((character) => ALPHABET.includes(character))
    .slice(0, SEED_LENGTH)
    .join("");
  return [characters.slice(0, 4), characters.slice(4, 8), characters.slice(8)]
    .filter(Boolean)
    .join("-");
}

/** How many characters a formatted seed still lacks. */
export function missingSeedCharacters(formatted: string): number {
  return SEED_LENGTH - formatted.replaceAll("-", "").length;
}

/** Why a formatted seed can never be valid, whatever comes next; null otherwise. */
export function seedError(formatted: string): string | null {
  const first = ALPHABET.indexOf(formatted[0] ?? "0");
  return first > MAXIMUM_FIRST_CHARACTER_VALUE
    ? "A seed starts with a digit or a letter from A to F."
    : null;
}
