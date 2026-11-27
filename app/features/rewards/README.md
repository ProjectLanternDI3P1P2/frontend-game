# Rewards

US 611 — group reward distribution summary.

| API function    | Gateway route                                    | Used by |
| --------------- | ------------------------------------------------ | ------- |
| `getRunRewards` | `GET /api/rewards/v1/runs/:dungeonRunId/rewards` | US 611  |

The dungeon victory screen loads the summary once the run ID is available.
Reward returns recipient identifiers. When the Player session is available,
the screen resolves hero names from its members.

Each recipient shows the hero name and who plays it: **You** for the
connected player, **Teammate** for another participant. Reward returns player
IDs only and no service exposes player names to the game front, so the hero
in the session is what identifies the receiving player.

| HTTP status     | Screen                                                  |
| --------------- | ------------------------------------------------------- |
| 401 / 403 / 404 | "Récompenses indisponibles", no detail, no retry        |
| 503             | Player cannot confirm the participation yet, with retry |
| Other errors    | Generic error with retry                                |

The 503 case covers Player not serving `RewardPlayerService.GetRunParticipation`
yet: Reward refuses access rather than granting it by default.
