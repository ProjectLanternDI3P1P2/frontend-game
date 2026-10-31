# Performance budgets

ADR-FE-014. Two things are measured, and they are not interchangeable.

## Field measurement — the reference

`app/plugins/telemetry.client.ts` collects LCP, INP and CLS with the
`web-vitals` library and ships them to the platform endpoint (ADR-FE-013).

Targets are read at the **75th percentile, segmented mobile / desktop**, once
there are enough samples:

| Metric | Target   | Applies to                                           |
| ------ | -------- | ---------------------------------------------------- |
| LCP    | ≤ 2.5 s  | Public-site routes; the game client's initial route. |
| INP    | ≤ 200 ms | Both.                                                |
| CLS    | ≤ 0.1    | Both.                                                |

## Game-specific measure

`time-to-interactive-game`: the time between a confirmed authentication and a
run view the player can actually act on.

- Started by `markAuthenticated()` in the session store, when the Gateway
  confirms the credentials.
- Closed by `markGameInteractive()` on `/play`, when the map is rendered **and**
  accepting input — not when the page first paints.

**There is no numeric budget for it yet, on purpose.** ADR-FE-014 requires a
first representative deployed baseline before fixing a value, because a number
guessed now would be defended rather than met. Fix it after cycle 1.

## Lab measurement — regression detection only

Lighthouse runs in CI on representative routes with `lighthouse-budget.json`.
It is a laboratory measurement: a good score does not mean players have a good
experience, and ADR-FE-014 explicitly refuses to let it replace field data.

Note that Lighthouse cannot measure INP in the lab; the budget uses Total
Blocking Time as a proxy. TBT regressions are a signal, not a verdict.

## Audio

ADR-FE-016. Audio never weighs on the first render: nothing is fetched until the
player's first gesture.

| Asset group              | Budget (all formats served to one browser) | When it loads             |
| ------------------------ | ------------------------------------------ | ------------------------- |
| v1 sound effects         | ≤ 150 KB total                             | First user gesture        |
| Ambience loop, per theme | ≤ 700 KB                                   | Lazily, after the effects |

These are v1 values, to be revisited with real measurements. Improvements to
investigate (audio sprite, Service Worker cache, streamed ambience, lower
bitrates) are listed in ADR-FE-016.

## Keeping the budgets

The CSR game client pays for its JavaScript up front (ADR-FE-004), so initial
bundle size is the metric to watch here. Before adding a dependency, ask whether
an existing token, composable or twenty lines of code would do — that is also
why there is no UI library (ADR-FE-010), no game engine (ADR-FE-005) and no
generated API client (ADR-FE-011).

If a gameplay screen ever breaks the INP budget, capture the measurement before
proposing a Canvas renderer: ADR-FE-006 requires evidence, not intuition.
