# Accessibility — public site

ADR-FE-015. The public site targets RGAA compliance **with no expected
exception**: the exception clause exists for genuine gameplay constraints, and
there is no gameplay here.

It also matters to the product, not only to the standard. The client briefing
names "designed for everyone" and "new players who may find RPGs difficult to
enter" as an audience. This site is where those players decide whether the game
is for them.

## What the code already enforces

| Mechanism                                           | Where                                                  |
| --------------------------------------------------- | ------------------------------------------------------ |
| Skip link, landmarks, one `h1` per page             | `app/layouts/default.vue`                              |
| Visible focus ring, never removed                   | `--color-focus-ring`, `:focus-visible` in `_base.scss` |
| Reduced-motion honoured                             | `_reset.scss`, `bp.motion-safe`                        |
| Status conveyed by word and shape, not colour alone | `app/pages/status.vue`                                 |
| Real table semantics with a caption and row headers | `app/pages/status.vue`                                 |
| Machine-readable dates (`<time datetime>`)          | `app/pages/season.vue`                                 |
| Declared page language                              | `app.head.htmlAttrs.lang` in `nuxt.config.ts`          |

## How it is checked

- **Automated, every CI run:** `eslint-plugin-vuejs-accessibility` on lint, plus
  `cy.checkA11y()` (axe) in `cypress/e2e/shell.cy.ts`.
- **Manual, per pull request touching a page:** complete the journey with the
  keyboard only, and check the page still makes sense at 200 % zoom.

ADR-FE-015 makes both part of acceptance; neither replaces the other.

## If you ever think you need an exception here

You almost certainly do not. The exception clause is scoped to gameplay
constraints, and ADR-FE-015 explicitly forbids using it for ordinary UI controls
or content pages. If you believe you have a real case, document it in the game
client's `accessibility-exceptions.md` format and get the owning squad to agree
before merging.

## Game client — audio

ADR-FE-016. This is not an exception: the dungeon's sounds are built to meet
ADR-FE-015, and are recorded here so a later change does not undo it.

- **Sound is never the only carrier of information.** Every server-confirmed
  cue (gate opening, victory, floor descent, refused move) already has an
  `announce()` message read by the run's `aria-live` region. A player who is
  deaf, or plays muted, loses nothing but atmosphere.
- **Nothing plays before the player acts.** Audio starts on the first user
  gesture only, as browsers require.
- **The mute toggle is a real `<button>`** with `aria-pressed`, reachable by
  keyboard, in the `game` layout. The `M` key toggles it too; the shortcut does
  not fire while focus is in a text field.
- **The choice persists** (`localStorage`) and always wins over the default.
- **The ambience stays in the background:** a drone with no melody, at a low
  default level (0.4), so it does not mask screen-reader speech.
