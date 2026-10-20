# Player foundations

Shared contracts and typed Gateway calls for US-PLAYER-07 to US-PLAYER-11.

| API function   | Gateway route                                            | Used by |
| -------------- | -------------------------------------------------------- | ------- |
| `createHero`   | `POST /api/v1/players/:playerId/heroes`                  | US-07   |
| `listHeroes`   | `GET /api/v1/players/:playerId/heroes`                   | US-08   |
| `getHeroSheet` | `GET /api/v1/players/:playerId/heroes/:heroId`           | US-09   |
| `startSoloRun` | `POST /api/v1/players/:playerId/heroes/:heroId/sessions` | US-11   |

## Hero appearance

`createHero` sends an optional `appearance` (`skinTone` 1–10, `hairStyle`
`bald` | `bob1` | `dap1`, `hairColor` 1–13 or `null` when bald); the sheet and the
list return it. `appearance.ts` maps it, with the class headwear, to the Mana Seed
sheets in `app/assets/heroes/mana-seed/`, and `HeroSprite` draws every layer of a
frame in one canvas pass. Headwear hides the hair. No other file imports the sheets.

US-PLAYER-10 deliberately has no API function yet: the checked-in Player
backend has no delete endpoint or handler. Add it only alongside the backend
contract instead of guessing a route or response shape.
