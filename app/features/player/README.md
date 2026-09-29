# Player foundations

Shared contracts and typed Gateway calls for US-PLAYER-07 to US-PLAYER-11.

| API function   | Gateway route                                            | Used by |
| -------------- | -------------------------------------------------------- | ------- |
| `createHero`   | `POST /api/v1/players/:playerId/heroes`                  | US-07   |
| `listHeroes`   | `GET /api/v1/players/:playerId/heroes`                   | US-08   |
| `getHeroSheet` | `GET /api/v1/players/:playerId/heroes/:heroId`           | US-09   |
| `startSoloRun` | `POST /api/v1/players/:playerId/heroes/:heroId/sessions` | US-11   |

US-PLAYER-10 deliberately has no API function yet: the checked-in Player
backend has no delete endpoint or handler. Add it only alongside the backend
contract instead of guessing a route or response shape.
