/**
 * Leaderboard capability's typed boundary to the API Gateway (ADR-FE-011).
 *
 * The backend owns the hero ranking contract at `/api/leaderboard/v1`.
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

const RANKING_HEROES = "leaderboard/heroes";

function heroPath(heroId: string): string {
  return `${RANKING_HEROES}/${encodeURIComponent(heroId)}`;
}

/** `class` is left out for "all classes" (`null`), `search` when blank. */
export function toRankingRequestQuery(
  query: RankingQuery,
): NonNullable<GatewayRequest["query"]> {
  const search = query.search.trim();
  return {
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
        `leaderboard/players/${encodeURIComponent(playerId)}/heroes/${encodeURIComponent(heroId)}/statistics`,
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
      return client.get<PublicRankingResponse>("leaderboard/public", {
        signal,
      });
    },
  };
}
