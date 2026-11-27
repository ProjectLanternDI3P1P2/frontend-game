# Rewards

US 611 — group reward distribution summary.

| API function    | Gateway route                                    | Used by |
| --------------- | ------------------------------------------------ | ------- |
| `getRunRewards` | `GET /api/rewards/v1/runs/:dungeonRunId/rewards` | US 611  |

The dungeon victory screen loads the summary once the run ID is available.
Reward returns recipient identifiers. When the Player session is available,
the screen resolves hero names from its members.

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
