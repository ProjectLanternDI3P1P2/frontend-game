# Project Lantern — public site

The discoverable half of Project Lantern: landing page, universe, how to play,
the live season, and the service status page.

"EASY TO DISCOVER" is one of the three product promises in the client briefing,
which is why this application exists separately from the game client
(ADR-FE-002) and lives in its own repository (ADR-FE-007).

> **Architecture overview:** open [`docs/architecture.html`](docs/architecture.html)
> in any browser (double-click it). It covers both front-end applications, the
> ADR → code mapping, the data flows and the open decisions. It needs no
> tooling; the diagrams need an internet connection.

## Rendering — the decision this repo exists to carry

ADR-FE-003 requires hybrid rendering, with **every non-default route documented
and justified**. The policy, the two allowed SSR shapes and the register of
routes live in [docs/rendering-modes.md](docs/rendering-modes.md); the modes
themselves are declared in `nuxt.config.ts` → `routeRules`.

In short:

- **Static is the default** — cheap, indexable, readable before JavaScript runs,
  and it survives the API Gateway being down.
- **SSR is the exception and has to be argued**: what changes between two
  requests that a build cannot know? Two shapes are allowed, one with a `swr`
  window, one with caching disabled — and an SSR route without a stated caching
  strategy is not acceptable.
- **CSR is never the default here.** The authenticated game client is the CSR
  application (ADR-FE-004); this one is not.

The register is currently empty: only `/` exists, and it is static.

## Getting started

```bash
npm install
cp .env.example .env
npm run dev
```

| Command                             | What it does                                   |
| ----------------------------------- | ---------------------------------------------- |
| `npm run dev`                       | Development server on http://localhost:3000    |
| `npm run build` / `npm run preview` | Production build (server + prerendered routes) |
| `npm run generate`                  | Static-only output, for the prerendered subset |
| `npm run lint`                      | ESLint, including the accessibility rules      |
| `npm run typecheck`                 | `vue-tsc` over the whole application           |
| `npm run test:unit`                 | Vitest                                         |
| `npm run test:e2e`                  | Cypress against a running server               |

`GET /healthz` returns app name, version, commit and build time.

## Runtime configuration

All deployable front-end configuration is supplied through public Nuxt runtime
variables. Pass them when starting the container; do not bake a `.env` file
into the image. They are intentionally public because they are exposed to the
browser, so never put a secret in one of them.

| Variable | Required in production | Purpose |
| --- | --- | --- |
| `NUXT_PUBLIC_API_GATEWAY_URL` | Yes | Public URL of the API Gateway, including the SignalR endpoint host. |
| `NUXT_PUBLIC_API_VERSION` | No | Gateway API version; defaults to `v1`. |
| `NUXT_PUBLIC_SITE_URL` | Yes | Public URL of this application, used for its canonical link. |
| `NUXT_PUBLIC_TELEMETRY_ENDPOINT` | No | Endpoint receiving browser telemetry; empty disables it. |
| `NUXT_PUBLIC_APP_NAME` | No | Application name included in telemetry and `/healthz`. |
| `NUXT_PUBLIC_APP_VERSION` | No | Release version included in telemetry and `/healthz`. |
| `NUXT_PUBLIC_COMMIT_SHA` | No | Source revision exposed by `/healthz`. |
| `NUXT_PUBLIC_BUILT_AT` | No | Build timestamp exposed by `/healthz`. |

For Docker, for example:

```bash
docker run --rm -p 3000:3000 \
  -e NUXT_PUBLIC_API_GATEWAY_URL=https://api.example.com \
  -e NUXT_PUBLIC_SITE_URL=https://game.example.com \
  frontend-game:local
```

## Architecture map

This repository is an **architecture skeleton**: the rendering policy, the
folder shape, the ownership map and the quality gates are in place. The features
themselves are empty on purpose — they belong to the squads that own them.

```text
app/
  features/
    _template/   the worked example; copy it to start a feature
    universe/    heroes and creatures      | each holds its README:
    rules/       how to play               | owner squad, expected rendering
    season/      live season               | mode, scope
    status/      service health            |
  shared/
    ui/          presentational primitives, auto-imported
    composables/ useGateway
    utils/       gateway transport, telemetry
  pages/         routes; they compose features
  layouts/ plugins/ assets/styles/
server/routes/healthz.ts
cypress/         end-to-end harness
docs/            adr/, rendering modes, tokens, budgets, accessibility
lighthouse-budget.json
```

`app/pages/` holds a single placeholder. Each squad adds its own routes, its
navigation entry, its `routeRules` line and its row in the rendering register.

To start a feature: `cp -r app/features/_template app/features/<name>` and
follow its README.

The structure, the ownership rules and the "add a feature" procedure are the
same as in the game client (ADR-FE-009) — see that repository's README for the
long form. The short version:

- Only `api/` talks to the API Gateway, through hand-written typed functions
  (ADR-FE-011).
- Nothing moves into `shared/` before it has two real consumers.
- No literal colour or spacing in a component: use a design token (ADR-FE-010).
- Every new route declares its rendering mode in `nuxt.config.ts` **and**
  justifies it in `docs/rendering-modes.md` (ADR-FE-003).

## Performance

Budgets and how they are measured: [docs/performance-budgets.md](docs/performance-budgets.md).
Lighthouse runs in CI against the representative routes with
`lighthouse-budget.json`; the field measurements collected by the telemetry
plugin remain the reference for real user experience (ADR-FE-013, ADR-FE-014).

## Accessibility

The public site targets RGAA compliance with **no expected exception**: nothing
here is a gameplay constraint. See [docs/accessibility.md](docs/accessibility.md).
