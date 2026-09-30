/** Player capability's typed boundary to the API Gateway (ADR-FE-011). */
import type {
  CreateHeroRequest,
  CreateHeroResponse,
  HeroClassOption,
  HeroSheet,
  HeroSummary,
} from "../types";
import { useGateway } from "~/shared/composables/useGateway";
import type { GatewayClient } from "~/shared/utils/gateway";

function heroesPath(playerId: string): string {
  return `players/${encodeURIComponent(playerId)}/heroes`;
}

/**
 * Kept framework-free for unit tests. UI code should obtain it through
 * `usePlayerApi()` rather than calling the Gateway directly.
 */
export function createPlayerApi(client: GatewayClient) {
  return {
    listHeroClasses(signal?: AbortSignal): Promise<HeroClassOption[]> {
      return client.get<HeroClassOption[]>("hero-classes", { signal });
    },

    listHeroes(playerId: string, signal?: AbortSignal): Promise<HeroSummary[]> {
      return client.get<HeroSummary[]>(heroesPath(playerId), { signal });
    },

    getHeroSheet(
      playerId: string,
      heroId: string,
      signal?: AbortSignal,
    ): Promise<HeroSheet> {
      return client.get<HeroSheet>(
        `${heroesPath(playerId)}/${encodeURIComponent(heroId)}`,
        { signal },
      );
    },

    createHero(
      playerId: string,
      request: CreateHeroRequest,
    ): Promise<CreateHeroResponse> {
      return client.post<CreateHeroResponse>(heroesPath(playerId), request);
    },

    selectHero(playerId: string, heroId: string): Promise<undefined> {
      return client.put<undefined>(
        `${heroesPath(playerId)}/${encodeURIComponent(heroId)}/selection`,
      );
    },

    deselectHero(playerId: string, heroId: string): Promise<undefined> {
      return client.delete<undefined>(
        `${heroesPath(playerId)}/${encodeURIComponent(heroId)}/selection`,
      );
    },
  };
}

export function usePlayerApi() {
  return createPlayerApi(useGateway());
}
