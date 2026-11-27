# Rewards

US 611 — group reward distribution summary.

| API function    | Gateway route                                    | Used by |
| --------------- | ------------------------------------------------ | ------- |
| `getRunRewards` | `GET /api/rewards/v1/runs/:dungeonRunId/rewards` | US 611  |

The dungeon victory screen loads the summary once the run ID is available.
Reward returns recipient identifiers. When the Player session is available,
the screen resolves hero names from its members.

Each recipient shows the hero name and who plays it: **You** for one of the
connected player's heroes (read from Player's `me/heroes`), **Teammate** for
another hero of the session. Reward returns player IDs only and no service
exposes player names to the game front, so the hero identifies the receiving
player. Heroes are matched rather than player IDs because the game routes may
carry the `me` alias instead of the player's UUID.

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
