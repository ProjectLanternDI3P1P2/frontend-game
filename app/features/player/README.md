# Player foundations

Shared contracts and typed Gateway calls of the Player service. The current
player is resolved by the backend from the token (`me`): the `_playerId`
parameters are kept for call-site compatibility only.

| API function               | Gateway route                                                             | Used by |
| -------------------------- | ------------------------------------------------------------------------- | ------- |
| `listHeroClasses`          | `GET /api/player/v1/hero-classes`                                         | US-07   |
| `createHero`               | `POST /api/player/v1/me/heroes`                                           | US-07   |
| `listHeroes`               | `GET /api/player/v1/me/heroes`                                            | US-08   |
| `getHeroSheet`             | `GET /api/player/v1/me/heroes/:heroId`                                    | US-09   |
| `selectHero`               | `PUT /api/player/v1/me/heroes/:heroId/selection`                          | US-08   |
| `deselectHero`             | `DELETE /api/player/v1/me/heroes/:heroId/selection`                       | US-08   |
| `deleteHero`               | `DELETE /api/player/v1/me/heroes/:heroId`                                 | US-10   |
| `getPublicProfileById`     | `GET /api/player/v1/players/:playerId/public-profile` (anonymous)         | US-06   |
| `getPublicProfileByHandle` | `GET /api/player/v1/players/by-handle/:handle/public-profile` (anonymous) | US-06   |

## Public profile (US-PLAYER-06)

Public, indexable page `/profiles/:ref`, server-rendered with `swr: 60`
(`docs/rendering-modes.md`, decisions D21 to D25).

- **Anonymous calls**: both public-profile functions pass `token: null`, so no
  `Authorization` header leaves, even for a signed-in visitor. Traefik opens only
  these two routes without a JWT (router `player-public-profile-api`).
- **`ref`** (`publicProfileRules.ts`, `resolveProfileRef`): a GUID reads by id; a
  handle `[a-z0-9-]{1,32}` (lower-cased) reads by handle; anything else is a 404
  without calling the API.
- **Data**: `toPublicProfile` keeps only the contract's fields before they reach
  the `useAsyncData` state (which is serialised into the public HTML): display
  name, NG+ level, heroes (name, class, level, in the order received) and the
  public counters. `completedSessionCount` is shown as received (0 today).
- **Errors**: API 404 → a real HTTP 404 rendered by `app/error.vue` (« Player
  not found », `noindex`); any other failure → 503 with a fixed message and
  Retry, never cached.
- **SEO**: title « {displayName} — profile », description, canonical on the
  handle form (`siteUrl` + `/profiles/{handle}`).
- **Files**: `publicProfileRules.ts`, `composables/usePublicProfile.ts`,
  `components/PublicProfileView.vue`, `app/pages/profiles/[ref].vue`,
  `app/error.vue`.
- **Tests**: `tests/playerApi.spec.ts`, `tests/publicProfileRules.spec.ts`,
  `tests/usePublicProfile.spec.ts`, `tests/PublicProfileView.spec.ts`,
  `tests/US-PLAYER-06AcceptanceTest.spec.ts`,
  `cypress/e2e/US-PLAYER-06AcceptanceTest.cy.ts` (needs the Player backend with
  the seeded handle `maelisrune-00000000`).

## Hero appearance

`createHero` sends an optional `appearance` (`skinTone` 1–10, `hairStyle`
`bald` | `bob1` | `dap1`, `hairColor` 1–13 or `null` when bald); the sheet and the
list return it. `appearance.ts` maps it, with the class headwear, to the Mana Seed
sheets in `app/assets/heroes/mana-seed/`, and `HeroSprite` draws every layer of a
frame in one canvas pass. Headwear hides the hair. No other file imports the sheets.

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
