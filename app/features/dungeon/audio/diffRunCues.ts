/**
 * ADR-FE-016 — The single source of the cues the server confirms. The run
 * snapshot already says everything (ADR-FE-008): comparing the previous one
 * with the next tells what just happened, whether the change came from this
 * player, another member of the party, or a resynchronisation.
 *
 * Pure: no sound is played here, only decided.
 */
import type { DungeonRunResponse } from "../types";
import type { DungeonCue } from "./dungeonCues";

export function diffRunCues(
  previous: DungeonRunResponse | null,
  next: DungeonRunResponse | null,
): DungeonCue[] {
  // The first snapshot of a session has nothing to compare with: silence.
  if (!previous || !next || previous.id !== next.id) return [];

  if (previous.status === "active" && next.status === "won") return ["victory"];

  if (next.currentFloor > previous.currentFloor) return ["floorDown"];
  // Back on an earlier floor can only be a resynchronisation: nothing happened.
  if (next.currentFloor !== previous.currentFloor) return [];

  const cues: DungeonCue[] = [];
  if (!previous.floorBossDefeated && next.floorBossDefeated) cues.push("gateOpen");

  const known = new Set(previous.discoveredRoomIds);
  if (next.discoveredRoomIds.some((roomId) => !known.has(roomId))) {
    cues.push("roomDiscovered");
  }
  return cues;
}
