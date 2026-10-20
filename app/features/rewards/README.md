# Rewards

US 611 — group reward distribution summary.

| API function    | Gateway route                                                              | Used by |
| --------------- | -------------------------------------------------------------------------- | ------- |
| `getRunRewards` | `GET /api/rewards/runs/:dungeonRunId/rewards` (rewritten to `/api/v1/...`) | US 611  |

Reward only returns identifiers: hero names come from the session members.
Group rewards are empty in real conditions until Combat calls `GrantCombatReward`.
