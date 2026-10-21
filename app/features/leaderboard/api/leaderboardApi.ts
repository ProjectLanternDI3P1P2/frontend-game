/**
 * Leaderboard capability's typed boundary to the API Gateway (ADR-FE-011).
 *
 * PROVISIONAL (decisions D1, D8): written against the draft contract in
 * `types.ts`. `progression/...` resolves to `/api/v1/progression/...`, which
 * Traefik routes to the leaderboard service.
 */
import type {
  HeroStatisticsResponse,
  LeaderboardApi,
  PublicRankingResponse,
  RankingFactsResponse,
  RankingHeroDetail,
  RankingQuery,
  RankingResponse,
} from "../types";
import type { GatewayClient, GatewayRequest } from "~/shared/utils/gateway";

const RANKING_HEROES = "progression/leaderboard/heroes";

function heroPath(heroId: string): string {
  return `${RANKING_HEROES}/${encodeURIComponent(heroId)}`;
}

/** `class` is left out for "all classes" (`null`), `search` when blank. */
export function toRankingRequestQuery(
  query: RankingQuery,
): NonNullable<GatewayRequest["query"]> {
  const search = query.search.trim();
  return {
    playerId: query.playerId,
    ...(query.heroClass ? { class: query.heroClass } : {}),
    period: query.period,
    ...(search ? { search } : {}),
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
  };
}

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

    getRanking(query: RankingQuery, signal?: AbortSignal): Promise<RankingResponse> {
      return client.get<RankingResponse>(RANKING_HEROES, {
        query: toRankingRequestQuery(query),
        signal,
      });
    },

    getRankingHeroDetail(
      heroId: string,
      signal?: AbortSignal,
    ): Promise<RankingHeroDetail> {
      return client.get<RankingHeroDetail>(heroPath(heroId), { signal });
    },

    getRankingHeroFacts(
      heroId: string,
      signal?: AbortSignal,
    ): Promise<RankingFactsResponse> {
      return client.get<RankingFactsResponse>(`${heroPath(heroId)}/facts`, { signal });
    },

    getPublicRanking(signal?: AbortSignal): Promise<PublicRankingResponse> {
      return client.get<PublicRankingResponse>("progression/leaderboard/public", {
        signal,
      });
    },
  };
}
