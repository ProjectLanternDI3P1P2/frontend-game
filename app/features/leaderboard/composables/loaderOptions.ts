import type { LeaderboardApi } from "../types";

/** Options shared by the page composables; tests inject `api` and `now`. */
export interface LoaderOptions {
  api?: LeaderboardApi;
  now?: () => Date;
  /** Load on mount (default when called from a component). */
  immediate?: boolean;
}
