/** Player capability's typed boundary to the API Gateway (ADR-FE-011). */
import type {
  CreateHeroRequest,
  CreateHeroResponse,
  HeroSheet,
  HeroSummary,
  StartSoloRunRequest,
  StartSoloRunResponse,
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

    startSoloRun(
      playerId: string,
      heroId: string,
      request: StartSoloRunRequest,
    ): Promise<StartSoloRunResponse> {
      return client.post<StartSoloRunResponse>(
        `${heroesPath(playerId)}/${encodeURIComponent(heroId)}/sessions`,
        request,
      );
    },
  };
}

export function usePlayerApi() {
  return createPlayerApi(useGateway());
}
