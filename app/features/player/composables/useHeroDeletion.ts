/**
 * US-PLAYER-10 — the hero deletion flow of the hero sheet, kept out of the page so every
 * outcome can be tested: a free hero, a hero whose lobby is closed first, a hero playing a
 * running dungeon (409), a replayed request and an uncertain outcome.
 *
 * The open session comes from `HeroSummary.activeSession`, the single source of truth: a
 * `Lobby` is closed by the deletion, an `Active` run blocks it.
 */
import { computed, ref, type Ref } from "vue";
import { GatewayError } from "~/shared/utils/gateway";
import { HeroDeletionStep } from "../types";
import type { DeleteHeroResponse, HeroActiveSession } from "../types";

export interface HeroDeletionDependencies {
  deleteHero(playerId: string, heroId: string): Promise<DeleteHeroResponse>;
  /** Reads the hero and its summary again (after a refusal). */
  refresh(): Promise<void>;
  navigate(path: string): Promise<unknown> | unknown;
  notifySuccess(message: string, title: string): void;
}

export interface HeroDeletionTarget {
  id: string;
  name: string;
}

export const heroesPath = (playerId: string) =>
  `/players/${encodeURIComponent(playerId)}/heroes`;

/**
 * The lobby page is the only session route of the Player contract: it renders every state
 * (lobby, run being prepared, closed) itself.
 */
export const lobbyPath = (playerId: string, sessionId: string) =>
  `/players/${encodeURIComponent(playerId)}/play/lobbies/${encodeURIComponent(sessionId)}`;

export function useHeroDeletion(
  playerId: Readonly<Ref<string>>,
  hero: Readonly<Ref<HeroDeletionTarget | null>>,
  activeSession: Readonly<Ref<HeroActiveSession | null | undefined>>,
  dependencies: HeroDeletionDependencies,
) {
  const open = ref(false);
  const step = ref(HeroDeletionStep.CONFIRM);
  const deleting = ref(false);
  const error = ref("");

  const isInRunningSession = computed(() => activeSession.value?.state === "Active");
  const closesLobby = computed(() => activeSession.value?.state === "Lobby");
  const sessionId = computed(() => activeSession.value?.id ?? null);

  function start(): void {
    if (!hero.value) return;
    error.value = "";
    step.value = isInRunningSession.value
      ? HeroDeletionStep.BLOCKED
      : HeroDeletionStep.CONFIRM;
    open.value = true;
  }

  async function confirm(): Promise<void> {
    const target = hero.value;
    if (!target || deleting.value) return;

    deleting.value = true;
    error.value = "";
    try {
      // A replay answers `alreadyDeleted: true`: the hero is gone either way.
      await dependencies.deleteHero(playerId.value, target.id);
      open.value = false;
      dependencies.notifySuccess(
        `${target.name} has been deleted. A slot is free again.`,
        "Hero deleted",
      );
      await dependencies.navigate(heroesPath(playerId.value));
    } catch (cause) {
      if (cause instanceof GatewayError && cause.status === 409) {
        // The hero entered a running dungeon meanwhile: show the blocked state.
        await dependencies.refresh().catch(() => undefined);
        step.value = HeroDeletionStep.BLOCKED;
      } else {
        // Deletion is idempotent, so retrying after an uncertain outcome is safe.
        error.value =
          cause instanceof GatewayError && !cause.isOutcomeUncertain
            ? cause.message
            : "Unable to confirm the deletion. Please try again.";
      }
    } finally {
      deleting.value = false;
    }
  }

  function viewSession(): void {
    if (!sessionId.value) return;
    open.value = false;
    void dependencies.navigate(lobbyPath(playerId.value, sessionId.value));
  }

  return {
    open,
    step,
    deleting,
    error,
    isInRunningSession,
    closesLobby,
    sessionId,
    start,
    confirm,
    viewSession,
  };
}
