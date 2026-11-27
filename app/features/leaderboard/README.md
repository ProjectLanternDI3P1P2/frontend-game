# Leaderboard and hero statistics (F01, F00)

> **Owner squad:** progression

### Purpose

A player sees the cumulated value of every catalogue statistic for one of
their heroes (F01), and the ranking of heroes by total XP with their own heroes
(F00, decision D8: one row per hero, filters, pagination by 10, trend,
statuses). The pages now read the leaderboard backend. In local Development,
that service seeds 220 demonstration heroes in PostgreSQL. Hero event
projection remains to be implemented. `My progression` reads persisted hero
statistics from the backend and labels seeded values as demonstration data. The
tab resolves the selected hero from Player's `GET /player/me/heroes`; when no
hero is selected, it uses the first hero in that roster. The tab is disabled
when Player has no hero or its roster cannot be read.

F00 lays the shared foundation (contract, clients, simulated data, pure rules,
`RankingRowDetail.vue` placeholder). `/leaderboard` only shows the first page
(Rank, Hero, Total XP) until F02 brings the full page; F03 brings the row
detail and facts, F04 the public `/rankings` page.

### Routes

| Route                                          | Rendering | Why not static / why not SSR                                     |
| ---------------------------------------------- | --------- | ---------------------------------------------------------------- |
| `/leaderboard`                                 | CSR       | Personal ("my position"), changing data, no SEO value (D2).      |
| `/players/:playerId/heroes/:heroId/statistics` | CSR       | Personal hero data, changes after every game, no SEO value (D2). |

Both are declared in `nuxt.config.ts` → `routeRules` and justified in
`docs/rendering-modes.md`. After the `dev` authentication merge, the private
`/leaderboard` uses the Player route alias `me` for its own hero rows.
The signed-in name comes from Keycloak, not from the ranking row's player name.
The public `/rankings` page remains available without signing in. The running
application reads the backend; Vitest scenarios use the simulated client.

### APIs consumed (`types.ts`)

| Call                   | Gateway route                                                           | Resolved at                         |
| ---------------------- | ----------------------------------------------------------------------- | ----------------------------------- |
| `getHeroStatistics`    | `GET /api/leaderboard/v1/players/:playerId/heroes/:heroId/statistics`   | Each visit                          |
| `getRanking`           | `GET /api/leaderboard/v1/heroes?class&period&search&sort&page&pageSize` | Each visit, "Refresh", query change |
| `getRankingHeroDetail` | `GET /api/leaderboard/v1/heroes/:heroId`                                | Row expanded (F03)                  |
| `getRankingHeroFacts`  | `GET /api/leaderboard/v1/heroes/:heroId/facts`                          | Facts drawer (F03)                  |
| `getPublicRanking`     | `GET /api/leaderboard/v1/public?page=...`                               | `/rankings` (F04)                   |

Path segments are URL-encoded; `class` is left out for "all classes" (`null`)
and `search` when blank. No client cache: every visit re-reads, the backend
owns the figures (D3).

### Simulated or real data — one switch

`api/leaderboardSource.ts` is the only place that chooses the source:

- The running app uses `LeaderboardSource.GATEWAY`; Vitest retains
  `LeaderboardSource.SIMULATED` for deterministic scenario tests.
- In simulated mode, `?mock=` picks the scenario (default `played`, also for
  an unknown value), answered after ~300 ms (`delayMs: 0` in tests):
  - `played`: ranking LIVE; every statistic has a value.
  - `empty`: nobody ranked (`totalCount` 0) in a new season that has a
    `previousSeasonId`; no statistic (all 0).
  - `lagging`: LAGGING with `lagSeconds`, `pendingCount`, `correctUpTo` and a
    reason; more `isPending` lines.
  - `rebuilding`: REBUILDING at `rebuildProgress` 0.62, as of `snapshotAt`.
  - `frozen`: FROZEN since `frozenAt`, with a reason.
  - `error`: every method fails with a `GatewayError` 503.
  - `consolidating`: kept for the statistics (consolidation running, one key
    missing → 0); the ranking answers as `played`.
- Data lives in `mocks/`; only `api/simulatedLeaderboardApi.ts` imports it.

### Simulated ranking data (`mocks/rankingMocks.ts`)

Deterministic, dates relative to "now". The client applies the class filter,
the period, the search (case-insensitive, on player and hero names), the sort
and the pagination for real; `totalCount` and `me` follow the filters.

- **Population:** 220 heroes ranked all time = the 120 heroes of the current
  season (the "~120 heroes" of the sheet) + 100 heroes who only played earlier
  seasons. This is what lets the current player's Mage be ranked 210th all
  time while absent from a 120-hero season: ranks stay contiguous (1..n) over
  the selected period, never a gap.
- **Rank:** position by XP over the selected period (all time, season, week),
  among all classes. A class filter, a search or another sort never renumbers
  the lines. `totalXp` is the XP over the period.
- **Me** (`SIMULATED_PLAYER_ID`, player "MaelisRune"): Warrior 7th (trend
  ▲ 3, XP pending, active 12 seconds ago, rejected and pending facts), Shaman
  58th, Mage 210th and absent from the season. In the season: Warrior 2nd,
  Shaman 7th.
- Deleted players at all-time ranks 9, 73 and 150 (`playerId`/`playerName`
  null); `rankDelta` null (NEW) for one hero in 13; pending lines (more when
  `lagging`); one hero with no run (`lastActivityAt` null, no last runs).
- Detail and facts are derived from the same heroes (same name, class, level,
  owner; `xpFromFacts` = all-time XP); an unknown hero answers 404. The public
  rankings are the default (all-time) ranking: podium, best hero of each class,
  top 10 and pages of 50 heroes.
- Tests (or a story) can hand the views any `LeaderboardApi` with
  `provide(LEADERBOARD_API_KEY, api)`.

### Files

| File                        | Responsibility                                                 |
| --------------------------- | -------------------------------------------------------------- |
| `types.ts`                  | Provisional contract (F00, shared by F02–F04) and view models. |
| `statisticsCatalogue.ts`    | The ~15 statistics (key, label, category). Provisional.        |
| `statisticsRules.ts`        | Missing keys = 0, grouping by category, "Updated 3 min ago".   |
| `leaderboardRules.ts`       | Trend, medals, win rate, relative time, names, URL ↔ query.   |
| `api/`                      | Gateway client, simulated client, source selection.            |
| `composables/`              | One per page: loading / ready / empty / error, retry, refresh. |
| `components/*View.vue`      | Page content (single `h1`), fed by the composables.            |
| `components/*.vue` (others) | Presentation only, data in props.                              |
| `RankingRowDetail.vue`      | Placeholder (F00) for the expanded row, replaced by F03.       |

### Test coverage

| Level      | File                              | What it proves                                        |
| ---------- | --------------------------------- | ----------------------------------------------------- |
| Unit       | `tests/statisticsRules.spec.ts`   | Catalogue, zero-filling, grouping, consolidation age. |
| Unit       | `tests/leaderboardRules.spec.ts`  | Every rule, including invalid URL values.             |
| Unit       | `tests/leaderboardApi.spec.ts`    | Gateway routes, encoding and query parameters.        |
| Unit       | `tests/leaderboardSource.spec.ts` | Single switch, `?mock=` scenarios, delay, abort.      |
| Unit       | `tests/simulatedRanking.spec.ts`  | Simulated data, filters, sort, pages, detail, facts.  |
| Unit       | `tests/use*.spec.ts`              | Page states, retry, refresh, stale answers ignored.   |
| Component  | `tests/LeaderboardTable.spec.ts`  | Semantic table, "You" + `aria-current`.               |
| Component  | `tests/LeaderboardPages.spec.ts`  | Both views across the scenarios.                      |
| Component  | `tests/RankingRowDetail.spec.ts`  | Placeholder props (replaced by F03).                  |
| Acceptance | `tests/F01AcceptanceTest.spec.ts` | F01 criteria; ranking part adapted by F00.            |
| Acceptance | `tests/F00AcceptanceTest.spec.ts` | Written by the tester, one test per criterion.        |
