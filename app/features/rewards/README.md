# Rewards

US 611 — group reward distribution summary.

| API function    | Gateway route                                    | Used by |
| --------------- | ------------------------------------------------ | ------- |
| `getRunRewards` | `GET /api/rewards/v1/runs/:dungeonRunId/rewards` | US 611  |

Owner: SQUAD - Rewards. `useRewardsApi` builds its own client from the shared
`createGatewayClient` so the shared gateway code stays untouched: the Rewards
prefix is carried by the API version (`rewards/v1`), and a 401 is shown as
unavailable rewards instead of redirecting to the login page.

The local Traefik stack routes `/api/rewards/v1/...` to Reward as is
(`rewards-api` in `deploy/traefik/backend/routes.yaml`).

## Integration owned by other squads

The feature is not mounted yet. Wiring it needs a change outside Rewards:

- **Pages (Dungeon, Player):** render `RunRewardsPanel` on the victory screen
  (`pages/dungeon/[runId].vue`) and/or the run page, with the dungeon run ID
  and a `heroNames` map (hero ID → name) built from the session members:

  ```vue
  <RunRewardsPanel :run-id="dungeonRunId" :hero-names="heroNames" />
  ```

Each recipient shows the hero name and who plays it: **You** when its player
ID equals `viewerPlayerId`, **Teammate** for another player. Reward returns
`viewerPlayerId` from the participation Player confirmed, so the game routes'
`me` alias never matters and a hero deleted since the run is still yours. No
service exposes player names to the game front: hero names come from the
session, with "Unknown hero" as a fallback, and the badges stay neutral when
either player ID is missing.

`SHARED_PER_PARTICIPANT` rewards carry a **Shared per participant** badge: every
eligible participant received their own reward for that event (enemy loot is
drawn per hero, so each line lists only who got that item).

| HTTP status     | Screen                                                  |
| --------------- | ------------------------------------------------------- |
| 401 / 403 / 404 | "Récompenses indisponibles", no detail, no retry        |
| 503             | Player cannot confirm the participation yet, with retry |
| Other errors    | Generic error with retry                                |

The 503 case covers Player not serving `RewardPlayerService.GetRunParticipation`
yet: Reward refuses access rather than granting it by default.
