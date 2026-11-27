import type { PublicProfile } from "../../types";

export const PUBLIC_PLAYER_ID = "3f2b8c1e-4d5a-4f6b-9c7d-0e1f2a3b4c5d";
export const PUBLIC_HANDLE = "maelisrune-00000000";

export function publicProfileFixture(
  overrides: Partial<PublicProfile> = {},
): PublicProfile {
  return {
    playerId: PUBLIC_PLAYER_ID,
    publicHandle: PUBLIC_HANDLE,
    displayName: "Maelis Rune",
    newGamePlusLevel: 2,
    heroes: [
      { name: "Aldric", classCode: "warrior", className: "Warrior", level: 12 },
      { name: "Sylwen", classCode: "mage", className: "Mage", level: 9 },
    ],
    counters: { heroCount: 2, highestHeroLevel: 12, completedSessionCount: 0 },
    ...overrides,
  };
}
