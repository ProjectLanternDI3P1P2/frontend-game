# Inventory

Read-only view of a hero's inventory, owned by the Reward backend.

| API function       | Gateway route                          | Used by                   |
| ------------------ | -------------------------------------- | ------------------------- |
| `getHeroInventory` | `GET /api/v1/heroes/:heroId/inventory` | Hero sheet (US-PLAYER-09) |

- **Server authority (ADR-FE-008):** rewards are granted by Combat and Dungeon
  through Reward, never by the browser. Reward grants are idempotent, so a
  replayed grant leaves the inventory unchanged; the client re-reads the
  inventory (`useHeroInventory().refresh()`) instead of adding a reward locally.
- **Degraded mode:** if Reward fails, the panel says so and the rest of the hero
  sheet stays usable. A 404 (Reward does not know the hero yet) is shown as empty — a
  provisional choice until the backend creates an inventory for each new hero.
- **Not built yet:** refreshing after a chest claim or a combat victory (the
  Combat contract is not wired yet), reward-received notifications and
  group-reward results.
