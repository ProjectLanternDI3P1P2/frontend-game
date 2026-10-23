# Project Lantern — game client

The authenticated Project Lantern game client: players sign in through Keycloak,
manage their heroes, join games, and explore dungeons. In production, it is
served below `/game/`.

> **Architecture overview:** open [`docs/architecture.html`](docs/architecture.html)
> in any browser (double-click it). It covers both front-end applications, the
> ADR → code mapping, the data flows and the open decisions. It needs no
> tooling; the diagrams need an internet connection.

## Rendering

The application shell at `/` is server-rendered so that it remains readable
before hydration. Game routes are client-rendered because Keycloak restores the
browser session from `sessionStorage`; the server cannot know whether a player
has an active session. Route modes are declared in `nuxt.config.ts` under
`routeRules`.

- `/` retains server-rendered shell content before JavaScript starts.
- `/auth`, `/home`, `/players/**`, and `/dungeon/**` are client-rendered and
  protected by the global authentication middleware.
- `/demo/**` is client-rendered because it loads the same runtime configuration
  and client plugins as the game.

## Getting started

To run both frontends, the five microservices, PostgreSQL and Traefik together,
see [the local Docker Compose stack](docs/local-stack.md).

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

The E2E job is deliberately commented out in CI for now. The suite remains in
the repository and can be run locally; re-enable the job once the deployment
environment is stable.

`GET /healthz` returns app name, version, commit and build time.

## Runtime configuration

All deployable front-end configuration is supplied through public Nuxt runtime
variables. Pass them when starting the container; do not bake a `.env` file
into the image. They are intentionally public because they are exposed to the
browser, so never put a secret in one of them.

| Variable                         | Required in production | Purpose                                                             |
| -------------------------------- | ---------------------- | ------------------------------------------------------------------- |
| `NUXT_PUBLIC_API_GATEWAY_URL`    | Yes                    | Public URL of the API Gateway, including the SignalR endpoint host. |
| `NUXT_PUBLIC_API_VERSION`        | No                     | Gateway API version; defaults to `v1`.                              |
| `NUXT_PUBLIC_SITE_URL`           | Yes                    | Public URL of this application, used for its canonical link.        |
| `NUXT_PUBLIC_TELEMETRY_ENDPOINT` | No                     | Endpoint receiving browser telemetry; empty disables it.            |
| `NUXT_PUBLIC_APP_NAME`           | No                     | Application name included in telemetry and `/healthz`.              |
| `NUXT_PUBLIC_APP_VERSION`        | No                     | Release version included in telemetry and `/healthz`.               |
| `NUXT_PUBLIC_COMMIT_SHA`         | No                     | Source revision exposed by `/healthz`.                              |
| `NUXT_PUBLIC_BUILT_AT`           | No                     | Build timestamp exposed by `/healthz`.                              |
| `NUXT_PUBLIC_KEYCLOAK_URL`       | Yes                    | Public Keycloak URL.                                                |
| `NUXT_PUBLIC_KEYCLOAK_REALM`     | Yes                    | Keycloak realm used by the game client.                             |
| `NUXT_PUBLIC_KEYCLOAK_CLIENT_ID` | Yes                    | Public Keycloak client identifier.                                  |

For Docker, for example:

```bash
docker run --rm -p 3000:3000 \
  -e NUXT_PUBLIC_API_GATEWAY_URL=https://api.example.com \
  -e NUXT_PUBLIC_SITE_URL=https://game.example.com \
  frontend-game:local
```

## Architecture map

```text
app/
  features/
    auth/        Keycloak integration and session restoration
    player/      heroes and lobby flows
    dungeon/     dungeon exploration
    reward/      reward presentation
  shared/
    ui/          presentational primitives, auto-imported
    composables/ useGateway
    utils/       gateway transport, telemetry
  pages/         authenticated game routes
  layouts/ plugins/ assets/styles/
server/routes/healthz.ts
cypress/         end-to-end harness
docs/            adr/, rendering modes, tokens, budgets, accessibility
lighthouse-budget.json
```

The short version:

- Only `api/` talks to the API Gateway, through hand-written typed functions
  (ADR-FE-011).
- Nothing moves into `shared/` before it has two real consumers.
- No literal colour or spacing in a component: use a design token (ADR-FE-010).
- Every new route declares its rendering mode in `nuxt.config.ts`.

## Performance

Budgets and how they are measured: [docs/performance-budgets.md](docs/performance-budgets.md).
Lighthouse is temporarily removed from CI while the team focuses on completing
the game flow. The field measurements collected by the telemetry plugin remain
the reference for real user experience (ADR-FE-013, ADR-FE-014).

## Accessibility

The public site targets RGAA compliance with **no expected exception**: nothing
here is a gameplay constraint. See [docs/accessibility.md](docs/accessibility.md).
