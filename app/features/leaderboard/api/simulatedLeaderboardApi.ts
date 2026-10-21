/**
 * Simulated implementation of `LeaderboardApi` (decision D1), used until the
 * leaderboard service is available. Same interface as the Gateway client, so
 * nothing above `api/` knows which one it talks to. With `?mock=error`, every
 * method fails with a `GatewayError` (503).
 */
import {
  simulatedFailure,
  simulatedHeroStatistics,
  simulatedNotFound,
} from "../mocks/leaderboardMocks";
import {
  simulatedHeroDetail,
  simulatedHeroFacts,
  simulatedPublicRanking,
  simulatedRanking,
} from "../mocks/rankingMocks";
import { MockScenario, type LeaderboardApi } from "../types";

/** Short enough to stay pleasant, long enough to see the loading state. */
export const SIMULATED_DELAY_MS = 300;

export interface SimulatedLeaderboardApiOptions {
  scenario?: MockScenario;
  delayMs?: number;
  now?: () => Date;
}

function wait(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    function onAbort() {
      clearTimeout(timer);
      reject(signal?.reason);
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function createSimulatedLeaderboardApi(
  options: SimulatedLeaderboardApiOptions = {},
): LeaderboardApi {
  const scenario = options.scenario ?? MockScenario.PLAYED;
  const delayMs = options.delayMs ?? SIMULATED_DELAY_MS;
  const now = options.now ?? (() => new Date());

  async function respond<T>(build: () => T, signal?: AbortSignal): Promise<T> {
    await wait(delayMs, signal);
    if (scenario === MockScenario.ERROR) throw simulatedFailure();
    return build();
  }

  /** An unknown hero answers 404, as the Gateway would. */
  function found<T>(value: T | null, heroId: string): T {
    if (value === null) throw simulatedNotFound(heroId);
    return value;
  }

  return {
    getHeroStatistics(playerId, heroId, signal) {
      return respond(() => simulatedHeroStatistics(scenario, heroId, now()), signal);
    },
    getRanking(query, signal) {
      return respond(() => simulatedRanking(scenario, query, now()), signal);
    },
    getRankingHeroDetail(heroId, signal) {
      return respond(
        () => found(simulatedHeroDetail(scenario, heroId, now()), heroId),
        signal,
      );
    },
    getRankingHeroFacts(heroId, signal) {
      return respond(
        () => found(simulatedHeroFacts(scenario, heroId, now()), heroId),
        signal,
      );
    },
    getPublicRanking(signal) {
      return respond(() => simulatedPublicRanking(scenario, now()), signal);
    },
  };
}
