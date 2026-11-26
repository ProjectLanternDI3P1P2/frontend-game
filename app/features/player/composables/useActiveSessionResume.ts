/**
 * A hero can only be in one open session. When Player refuses a command with
 * `COMMAND_CONFLICT` and an `activeSessionId`, the page explains it and lets the player
 * resume that session instead of showing a generic error.
 */
import { ref, type Ref } from "vue";
import { PlayerCommandRejectedError, PlayerHubError } from "../api/playerHub";
import type { GameSessionSnapshot } from "../types";
import { lobbyPath } from "./useHeroDeletion";

const COMMAND_CONFLICT = "COMMAND_CONFLICT";

export interface ActiveSessionResumeDependencies {
  getSessionSnapshot(sessionId: string): Promise<GameSessionSnapshot>;
  navigate(path: string): Promise<unknown> | unknown;
}

/** A started run is played on the dungeon screen; any other state is shown by the lobby page. */
export function resumePath(playerId: string, session: GameSessionSnapshot): string {
  return session.state === "Active" && session.dungeonRunId
    ? `/dungeon/${encodeURIComponent(session.dungeonRunId)}?playerId=${encodeURIComponent(playerId)}`
    : lobbyPath(playerId, session.sessionId);
}

export function useActiveSessionResume(
  playerId: Readonly<Ref<string>>,
  dependencies: ActiveSessionResumeDependencies,
) {
  const activeSessionId = ref<string | null>(null);
  const resuming = ref(false);
  const resumeError = ref("");

  /** Returns true when the refusal is an active-session conflict that the notice now shows. */
  function capture(cause: unknown): boolean {
    if (
      !(cause instanceof PlayerCommandRejectedError) ||
      cause.code !== COMMAND_CONFLICT ||
      !cause.activeSessionId
    ) {
      return false;
    }
    activeSessionId.value = cause.activeSessionId;
    resumeError.value = "";
    return true;
  }

  function clear(): void {
    activeSessionId.value = null;
    resumeError.value = "";
  }

  async function resume(): Promise<void> {
    if (!activeSessionId.value || resuming.value) return;
    resuming.value = true;
    resumeError.value = "";
    try {
      const session = await dependencies.getSessionSnapshot(activeSessionId.value);
      await dependencies.navigate(resumePath(playerId.value, session));
    } catch (cause) {
      resumeError.value =
        cause instanceof PlayerHubError ? cause.message : "Unable to resume the game.";
    } finally {
      resuming.value = false;
    }
  }

  return { activeSessionId, resuming, resumeError, capture, clear, resume };
}
