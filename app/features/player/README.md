# Player foundations

Shared contracts and typed Gateway calls for US-PLAYER-07 to US-PLAYER-11.

| API function   | Gateway route                                            | Used by |
| -------------- | -------------------------------------------------------- | ------- |
| `createHero`   | `POST /api/v1/players/:playerId/heroes`                  | US-07   |
| `listHeroes`   | `GET /api/v1/players/:playerId/heroes`                   | US-08   |
| `getHeroSheet` | `GET /api/v1/players/:playerId/heroes/:heroId`           | US-09   |
| `deleteHero`   | `DELETE /api/v1/players/:playerId/heroes/:heroId`        | US-10   |
| `startSoloRun` | `POST /api/v1/players/:playerId/heroes/:heroId/sessions` | US-11   |

US-PLAYER-10 deletion is idempotent (a replay answers `alreadyDeleted: true`).
A hero waiting in a lobby is deleted after the lobby is closed for every member;
a hero playing a running dungeon is refused with 409. Reading a deleted hero
answers 410 Gone instead of 404.

## Hero sheets

The hero is a stack of Mana Seed sheets, never a single image. `appearance.ts`
is the only file that imports them and turns their codes (slot, style, colour)
into URLs; every view, the dungeon's included, goes through it.

- The sheets live in `app/assets/heroes/mana-seed/<slot>/` (`body`, `outfit`,
  `hair`, `hat`, `weapon`, `shield`), under the art's own names:
  `char_a_{page}_{layer}_{style}_v{NN}.webp`.
- To add a sheet, drop it in the folder of its slot and list it in
  `HERO_CATALOGUE`; `tests/appearance.spec.ts` checks that every listed sheet
  exists.
- Colours start at `v01`: `v00` is the artist's palette template.

The hero list tells which open session holds a hero through `activeSession`
(`{ id, state }`, `Lobby` or `Active`); `isEngagedInActiveSession` is derived from
it. The deletion flow lives in `composables/useHeroDeletion.ts`. A closed lobby
arrives on the lobby page as `Abandoned` (`failureReason: HeroDeleted`): the page
explains it and goes back to "Join a game" (`lobbyClosure.ts`).

This client contract ships with the backend pull request that adds the delete
endpoint: merge both together.
