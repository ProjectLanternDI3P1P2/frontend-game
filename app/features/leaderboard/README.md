# Leaderboard and hero statistics (F01)

> **Owner squad:** progression

### Purpose

A player sees the cumulated value of every catalogue statistic for one of
their heroes, and the top 50 players with their own position. The leaderboard
service consolidates about every 5 minutes; until it publishes its contract,
the pages run on simulated data behind the same interface (decision D1).

### Routes

| Route                                          | Rendering | Why not static / why not SSR                                     |
| ---------------------------------------------- | --------- | ---------------------------------------------------------------- |
| `/leaderboard`                                 | CSR       | Personal ("my position"), changing data, no SEO value (D2).      |
| `/players/:playerId/heroes/:heroId/statistics` | CSR       | Personal hero data, changes after every game, no SEO value (D2). |

Both are declared in `nuxt.config.ts` → `routeRules` and justified in
`docs/rendering-modes.md`. "Me" is `SEEDED_PLAYER_ID` until Keycloak lands (D5).

### APIs consumed (provisional contract, `types.ts`)

| Call                | Gateway route                                                         | Resolved at           |
| ------------------- | --------------------------------------------------------------------- | --------------------- |
| `getHeroStatistics` | `GET /api/v1/progression/players/:playerId/heroes/:heroId/statistics` | Each visit            |
| `getLeaderboard`    | `GET /api/v1/progression/leaderboard?limit=50&playerId=:playerId`     | Each visit, "Refresh" |

No client cache: every visit re-reads, the backend owns the figures (D3).

### Simulated or real data — one switch

`api/leaderboardSource.ts` is the only place that chooses the source:

- `LEADERBOARD_SOURCE = LeaderboardSource.SIMULATED` (today) or
  `LeaderboardSource.GATEWAY` (when the service is live). Nothing else changes.
- In simulated mode, `?mock=played|empty|consolidating|error` picks the
  scenario (default `played`), answered after ~300 ms:
  - `played`: every statistic has a value; I am ranked 7th.
  - `empty`: no statistic (all 0), nobody ranked.
  - `consolidating`: a consolidation runs, previous figures are served (one key
    missing → 0); I am ranked 87th, so my line is pinned under the table.
  - `error`: the service answers 503.
- Data lives in `mocks/`; only `api/simulatedLeaderboardApi.ts` imports it.
- Tests (or a story) can hand the views any `LeaderboardApi` with
  `provide(LEADERBOARD_API_KEY, api)`.

### Files

| File                        | Responsibility                                                 |
| --------------------------- | -------------------------------------------------------------- |
| `types.ts`                  | Provisional contract and view models.                          |
| `statisticsCatalogue.ts`    | The ~15 statistics (key, label, category). Provisional.        |
| `statisticsRules.ts`        | Missing keys = 0, grouping by category, "Updated 3 min ago".   |
| `leaderboardRules.ts`       | Sort by rank, top 50, my line flagged or pinned.               |
| `api/`                      | Gateway client, simulated client, source selection.            |
| `composables/`              | One per page: loading / ready / empty / error, retry, refresh. |
| `components/*View.vue`      | Page content (single `h1`), fed by the composables.            |
| `components/*.vue` (others) | Presentation only, data in props.                              |

### Test coverage

| Level      | File                              | What it proves                                        |
| ---------- | --------------------------------- | ----------------------------------------------------- |
| Unit       | `tests/statisticsRules.spec.ts`   | Catalogue, zero-filling, grouping, consolidation age. |
| Unit       | `tests/leaderboardRules.spec.ts`  | Order, limit of 50, my line in or out of the top.     |
| Unit       | `tests/leaderboardApi.spec.ts`    | Gateway routes and query.                             |
| Unit       | `tests/leaderboardSource.spec.ts` | Single switch, `?mock=` scenarios, delay, abort.      |
| Unit       | `tests/use*.spec.ts`              | Page states, retry, refresh, stale answers ignored.   |
| Component  | `tests/LeaderboardTable.spec.ts`  | Semantic table, "You" + `aria-current`, focus, pin.   |
| Component  | `tests/LeaderboardPages.spec.ts`  | Both views across the four scenarios.                 |
| Acceptance | `tests/F01AcceptanceTest.spec.ts` | Written by the tester, one test per criterion.        |
