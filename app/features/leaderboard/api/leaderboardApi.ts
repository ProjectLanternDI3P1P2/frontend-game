/**
 * Leaderboard capability's typed boundary to the API Gateway (ADR-FE-011).
 *
 * PROVISIONAL (decision D1): written against the draft contract in `types.ts`.
 * `progression/...` resolves to `/api/v1/progression/...`, which Traefik routes
 * to the leaderboard service.
 */
import type {
  HeroStatisticsResponse,
  LeaderboardApi,
  LeaderboardResponse,
} from "../types";
import { LEADERBOARD_LIMIT } from "../leaderboardRules";
import type { GatewayClient } from "~/shared/utils/gateway";

/** Kept framework-free for unit tests; pages go through `useLeaderboardApi()`. */
export function createLeaderboardApi(client: GatewayClient): LeaderboardApi {
  return {
    getHeroStatistics(
      playerId: string,
      heroId: string,
      signal?: AbortSignal,
    ): Promise<HeroStatisticsResponse> {
      return client.get<HeroStatisticsResponse>(
        `progression/players/${encodeURIComponent(playerId)}/heroes/${encodeURIComponent(heroId)}/statistics`,
        { signal },
      );
    },

    getLeaderboard(
      playerId: string,
      signal?: AbortSignal,
    ): Promise<LeaderboardResponse> {
      return client.get<LeaderboardResponse>("progression/leaderboard", {
        query: { limit: LEADERBOARD_LIMIT, playerId },
        signal,
      });
    },
  };
}
