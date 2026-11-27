import { onScopeDispose, shallowRef } from "vue";
import { createPlayerApi } from "~/features/player/api/playerApi";
import { useGateway } from "~/shared/composables/useGateway";

/**
 * Heroes of the connected player, read from Player's `me/heroes` route.
 * Recipients are matched by hero rather than by player ID because the game
 * routes may carry the `me` alias instead of the player's UUID.
 * Stays null while loading or when Player cannot answer.
 */
export function useOwnHeroIds() {
  const ownHeroIds = shallowRef<ReadonlySet<string> | null>(null);
  const request = new AbortController();
  // A failed lookup must not redirect away from the victory screen.
  const api = createPlayerApi(useGateway({ redirectOnUnauthorized: false }));

  api
    .listHeroes(undefined, request.signal)
    .then((heroes) => {
      if (!request.signal.aborted)
        ownHeroIds.value = new Set(heroes.map(({ id }) => id));
    })
    .catch(() => {
      // Recipients keep a neutral label.
    });

  onScopeDispose(() => request.abort());
  return ownHeroIds;
}
