# Combat

> **Owner squad:** Combat (ADR-FE-009)

### Purpose

The turn-based fight between the party and a pack of monsters, or a boss, drawn as in
the art team's mock-up: the dungeon room in the background, the party on the left, the
monsters on the right, and a parchment at the bottom with the party's gauges and the
**Fight / Object / Run** commands.

The Combat service resolves everything (ADR-FE-008): the client picks an action, the
service plays it together with the monsters' turns that follow and returns the events,
which the screen replays one by one (who strikes, who is hit, the numbers floating, the
gauges going down) before settling on the new state.

### Routes

| Route              | Rendering          | Why                                                         |
| ------------------ | ------------------ | ----------------------------------------------------------- |
| `/combat`          | CSR (`ssr: false`) | Opens a fight without a dungeon: test and balance it alone. |
| `/combat/:fightId` | CSR (`ssr: false`) | Turn-by-turn game state, nothing to prerender or index.     |

`/combat` reads `?encounter=Boss&floor=3&runId=…&returnTo=/dungeon/…`, so the dungeon
can later send the party into a fight and get it back.

### APIs consumed

| Call                | Gateway route                            | Cached |
| ------------------- | ---------------------------------------- | ------ |
| `startFight`        | `POST /api/v1/combats`                   | never  |
| `fetchFight`        | `GET /api/v1/combats/{fightId}`          | never  |
| `submitFightAction` | `POST /api/v1/combats/{fightId}/actions` | never  |

Every action carries a fresh `commandId`: a double click or a retry is applied once.

### Files

| File                              | Responsibility                                               |
| --------------------------------- | ------------------------------------------------------------ |
| `types.ts`                        | Hand-written mirror of the Combat contract (ADR-FE-011).     |
| `api/combatApi.ts`                | The only file that reaches the Gateway.                      |
| `combatRules.ts`                  | Targets, gauges replay, log sentences. Pure.                 |
| `combatSprites.ts`                | Animated sprites of the heroes and of each monster type.     |
| `composables/useCombat.ts`        | Fight state, command steps, replay beat by beat, resync.     |
| `composables/useBattleStage.ts`   | The stage: stances, placements, effects, shakes, timings.    |
| `composables/useMotionPreference.ts` | Full or reduced animations: system default, player choice. |
| `combatChoreography.ts`           | How each beat is staged: run in, strike, react, run back.    |
| `components/CombatEffect.vue`     | Slash, claws, fireball, frost, heal, shield, smoke (CSS).    |
| `components/CombatScene.vue`      | The room (dungeon tiles) and the fighters in their slots.    |
| `components/CombatFighter.vue`    | One fighter: sprite, pose, HP gauge, floating numbers.       |
| `components/CombatCommandPanel.vue` | The parchment: party gauges, commands, last log line.      |

The room reuses the Dungeon feature's tiles (`features/dungeon/tiles/tileset.ts`) so the
fight happens in the same stones as the floor around it. Data only is imported.

### Staging

The events of an action are grouped into beats (`groupIntoBeats`): an action and the
hits, heals and knock-outs it caused. Each beat is a choreography: a melee attacker runs
to its target (a CSS transition on its position), strikes, the target flashes and
recoils under the slash or the claws, the numbers pop, then the attacker runs back. A
spell gathers a magic circle under its caster, then a fireball flies across the room, or
a ring of frost bursts over every monster. Heavy hits shake the board, knocked-out
monsters flicker and melt into smoke, the party cheers on a victory.

Animations follow `prefers-reduced-motion` by default (ADR-FE-015), and the
"Animations" switch in the HUD lets the player choose: many systems turn reduced motion
on without the player knowing. Reduced, the same beats play four times faster, without
runs or shakes.

### Light and "shaders" (CSS and SVG only)

ADR-FE-005/006 rule out Canvas and WebGL, so the post-processing is done with CSS
blending and SVG filters, all in `components/`:

| Effect | How |
| ------ | --- |
| Torchlight, vignette, colour grade | `CombatAtmosphere.vue`: a cool shade multiplied over the room, warm pools added with `screen`, flickering |
| Dust and embers | `CombatAtmosphere.vue`: a few dozen DOM particles, CSS keyframes |
| Flame wobble | `#combat-heat` (`CombatFilters.vue`): animated `feTurbulence` + `feDisplacementMap` on torches and fire |
| Bloom | `#combat-bloom`: a blurred, saturated copy merged under the effect, with `mix-blend-mode: screen` |
| Casting glow | `#combat-glow-edge`: a dilated, blurred outline |
| Dissolve of a beaten monster | a noise mask per fighter (`CombatFighter.vue`), its threshold animated once with SMIL |
| Critical hit | rays, a shockwave bending the room (`backdrop-filter`), a hit-stop, the camera punching in |

The layers of the scene carry no `z-index`: one would make an isolated group, and the
light could no longer blend with the room. The camera (`combat-scene__camera`) is the
single isolated group; elements inside stack themselves (fighters by row, light at 800,
effects at 900).

The service adds critical hits (10 %, x1.5, `isCritical`) and dodges (`Missed`, 3 to
20 % from the speed gap); the turn order of the round shows at the top
(`CombatTurnOrder.vue`).

### Sprites

Monsters use the art team's sheets already in the repository (slimes and bats of
`objects.png`, `placeholder_mob.png`), one look per monster type in `MONSTER_LOOKS`.
Giving a type its own animated sheet is one entry there.

### Test coverage

| Level | File                         | What it proves                                         |
| ----- | ---------------------------- | ------------------------------------------------------ |
| Unit  | `tests/combatRules.spec.ts`  | Active hero, targets per action, gauge replay, log.    |
