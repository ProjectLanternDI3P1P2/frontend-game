# ADR-FE-016 — Client-Side Audio with the Web Audio API

**Status:** Accepted

## Context

The dungeon is playable but silent: no footsteps, no ambience, no cue when the
gate opens after the boss falls. Sound is pure rendering — the browser plays it,
the server has nothing to hear — so the question is where it is triggered, how
it is played, and how much it costs to load.

Constraints already in place:

- No game engine (ADR-FE-005) and a CSR game client that pays for its
  JavaScript up front (ADR-FE-004, ADR-FE-014).
- Moves are predicted on the client; the server is the authority
  (ADR-FE-008).
- The Dungeon service already sends the full run snapshot
  (`DungeonRunResponse`) after every accepted change, by acknowledgement and by
  the `DungeonStateChanged` hub event.
- Browsers refuse to start audio before a user gesture (autoplay policy).
- Accessibility is a requirement, not polish (ADR-FE-015).

## Decision

### Ownership

Audio lives entirely in the game client. There is **no audio microservice and
no backend change**: the backend stays the source of game events through the
snapshot it already sends.

### Triggers

- **Local, predicted actions** — the hero's step and a refused move (bump,
  locked gate) — play from `useDungeonExplorer.move()`, at prediction time, so
  the sound has no network latency.
- **Server-confirmed events** are derived by one pure function,
  `diffRunCues(previous, next): SoundCue[]`, run on every new `run` value. It
  is the **single source** for these cues; no sound is played directly from
  `fightBoss()`, `goDown()` or any other call site.

| Cue             | Rule (previous → next)                                |
| --------------- | ----------------------------------------------------- |
| Gate opens      | `floorBossDefeated` false → true, same `currentFloor` |
| Victory         | `status` `active` → `won`                             |
| Floor descent   | `currentFloor` increases                              |
| Room discovered | `discoveredRoomIds` gains an id                       |

The first snapshot of a session (join, reload, resynchronisation with no
previous state) has nothing to compare with and plays **no** cue.

### Scope of v1

Steps (2–3 random variants), bump / locked gate, gate opening, boss defeated and
final victory, floor descent, room discovered, and **one** ambience loop shared
by every floor theme.

Deferred: chest opening (the flow exists, the sound is a later story), a second
ambience per theme. Mob, combat and UI sounds belong to their owning squads and
reuse the shared engine.

### Playback engine

The native **Web Audio API**, behind a thin wrapper — no dependency.

- `app/shared/audio/`: `AudioEngine` (one `AudioContext`, a decoded-buffer
  cache, three gain buses `master` / `sfx` / `ambience`, preferences) and the
  `useAudio()` composable. Shared because other squads will use it.
- `app/features/dungeon/audio/`: the dungeon cue catalogue (`dungeonCues.ts`:
  cue → file(s), volume, variants) and `diffRunCues.ts`.

`HTMLAudioElement` is not used: it adds latency and handles overlapping short
sounds poorly.

### Files and format

- Served statically from `public/audio/`, one file per sound (no audio sprite
  in v1), with `public/audio/CREDITS.md` listing the origin and licence of each.
- **Opus in WebM** is the primary format: mono 48 kHz at 32–48 kbps for
  effects (a few KB each), stereo at 64–96 kbps for the ambience loop.
- **AAC (`.m4a`)** is the fallback, chosen at runtime with `canPlayType`.
- No WAV (too heavy), no MP3 (worse quality per byte, imperfect gapless loops).
- Files are produced by an `ffmpeg` script under `scripts/`, like the dungeon
  atlas (`assets:dungeon`).

### Loading

- Nothing audio-related is fetched for the first render.
- On the first user gesture, the `AudioContext` is created and the v1 effects
  are fetched and decoded.
- The ambience loop is fetched lazily afterwards; it may start a few seconds
  late.
- Budgets are in `docs/performance-budgets.md`.

### Preferences

Sound is **on by default once the first gesture unlocks it**, at moderate
levels (master 0.8, sfx 0.7, ambience 0.4). A mute toggle
(`shared/audio/AudioMuteToggle.vue`, placed in the run's HUD next to _Share_
and _Leave_, so it never overlaps the board's other overlays) and the `M` key
on the board switch it off; the choice is kept in `localStorage`, read and
written inside `try/catch`, and the engine works without it. A stored choice
always wins over the default.

### Accessibility

Sound is **never the only carrier of information**: every server-confirmed cue
already has an `announce()` message (aria-live). The mute toggle is a real
`<button>` with `aria-pressed`. Details in `docs/accessibility.md`.

### Art direction

Sounds must fit a pixel-art dungeon: light retro 8/16-bit effects (not pure
chiptune), a dark ambient drone with no melody. **CC0 only** (Kenney,
OpenGameArt filtered on CC0) or generated with jsfxr / ChipTone. Every file is
validated by ear by the owning squad before it is merged.

### Tests

- Vitest: `diffRunCues` on every rule above, including the first snapshot that
  plays nothing; `AudioEngine` against a mocked `AudioContext` (mute, volumes,
  failing `localStorage`, `play` before unlock is ignored).
- Vitest, component level: the mute toggle is a button with `aria-pressed`,
  toggles, and starts from the stored choice. It is not a Cypress spec: the run
  screen needs a live Dungeon service, which the end-to-end suite does not start
  yet. Move it to Cypress once that journey is covered end to end. Real audio
  output is not tested.

## Consequences

- The backend contract does not change; sound ships as a front-end-only change.
- Server-driven sounds follow the authoritative state, so they also play when
  the change comes from another party member or, later, from Combat.
- A new server event that a snapshot diff cannot express unambiguously will
  need an explicit event in the contract; that is a contract change, decided
  then.
- The shared engine gives other squads one way to play sound instead of
  several.
- Audio adds weight after the first gesture; it is bounded by the budgets and
  never delays the first render.

## Alternatives Considered

- **An audio microservice:** rejected — the server has no sound to produce, and
  serving static files through .NET adds a hop for nothing.
- **Explicit `events` in `DungeonStateChanged`:** deferred — every v1 cue is
  derivable from the snapshot, and a contract change costs both repositories.
- **Howler.js:** rejected for v1 — it solves format fallback and autoplay
  unlocking, which a few lines of Web Audio cover, at the price of a
  dependency ADR-FE-014 asks us to justify.
- **`<audio>` elements:** rejected — latency and poor overlap for rapid steps.
- **MP3 / WAV:** rejected — see _Files and format_.

## Possible Improvements — to Investigate

The v1 budget is a starting point, not a ceiling. To study once a baseline
exists:

- an audio sprite (all effects in one file) to save requests;
- caching audio in a Service Worker so returning players download nothing;
- streaming the ambience (`MediaElementAudioSourceNode`) instead of decoding it
  whole;
- lower bitrates or adaptive quality on constrained connections;
- one ambience per floor theme.
