/**
 * Simulated implementation of `LeaderboardApi` (decision D1), used until the
 * leaderboard service is available. Same interface as the Gateway client, so
 * nothing above `api/` knows which one it talks to.
 */
import {
  simulatedHeroStatistics,
  simulatedLeaderboard,
  simulatedFailure,
} from "../mocks/leaderboardMocks";
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

  return {
    getHeroStatistics(playerId, heroId, signal) {
      return respond(() => simulatedHeroStatistics(scenario, heroId, now()), signal);
    },
    getLeaderboard(playerId, signal) {
      return respond(() => simulatedLeaderboard(scenario, playerId, now()), signal);
    },
  };
}
