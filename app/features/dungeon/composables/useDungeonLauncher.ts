/**
 * Starts an exploration. In the target flow (ADR-GLOB-011), the Player service
 * creates the game session and asks Dungeon for the run; until Player exposes
 * that endpoint, the launcher asks Dungeon directly with a client-side session
 * id. Only this file changes when Player is ready.
 */
import { ref } from "vue";
import { createDungeonRun } from "../api/dungeonApi";
import { usePlayerApi } from "~/features/player/api/playerApi";

export function useDungeonLauncher() {
  const isStarting = ref(false);
  const errorMessage = ref<string | null>(null);

  /** Returns the id of the new run, or null when it could not be created. */
  async function start(seed?: string): Promise<string | null> {
    isStarting.value = true;
    errorMessage.value = null;
    try {
      const run = await createDungeonRun({
        gameSessionId: crypto.randomUUID(),
        seed: seed?.trim() || undefined,
        heroIds: await partyHeroIds(),
      });
      return run.id;
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : "The dungeon could not be created.";
      return null;
    } finally {
      isStarting.value = false;
    }
  }

  /**
   * The hero selected in the lobby (else the first one) joins the run, so that a contact
   * with a mob opens a real fight in Combat. Without a hero (none created, Player down),
   * the run starts anyway with the historical stand-in.
   */
  async function partyHeroIds(): Promise<string[]> {
    try {
      const heroes = await usePlayerApi().listHeroes();
      const hero = heroes.find((candidate) => candidate.isSelected) ?? heroes[0];
      return hero ? [hero.id] : [];
    } catch {
      return [];
    }
  }

  return { isStarting, errorMessage, start };
}
