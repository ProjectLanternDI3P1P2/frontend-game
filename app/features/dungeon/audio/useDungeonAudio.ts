/**
 * ADR-FE-016 — The dungeon's sounds on the shared engine: plays a cue by name,
 * draws one of its variants, and starts or stops the ambience of a run.
 */
import { useAudio } from "~/shared/audio/useAudio";
import type { DungeonCue } from "./dungeonCues";
import { DUNGEON_AMBIENCE, DUNGEON_CUES, DUNGEON_EFFECT_FILES } from "./dungeonCues";

export interface DungeonSound {
  play: (cue: DungeonCue) => void;
}

/** Silence: what the explorer uses when no sound is wired (tests, other screens). */
export const SILENT_DUNGEON: DungeonSound = { play: () => {} };

export function useDungeonAudio(random: () => number = Math.random) {
  const audio = useAudio();
  audio.preload(DUNGEON_EFFECT_FILES);

  function play(cue: DungeonCue): void {
    const { files, volume } = DUNGEON_CUES[cue];
    const file = files[Math.floor(random() * files.length)] ?? files[0]!;
    audio.play(file, { bus: "sfx", volume });
  }

  return {
    play,
    preferences: audio.preferences,
    toggleMuted: audio.toggleMuted,
    startAmbience: () =>
      audio.startAmbience(DUNGEON_AMBIENCE.file, DUNGEON_AMBIENCE.volume),
    stopAmbience: audio.stopAmbience,
  };
}
