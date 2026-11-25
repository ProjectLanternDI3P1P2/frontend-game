[← README](README.md)

# Sharding et orchestration

## Critères

- Des specs réparties automatiquement entre les runners, sans liste à tenir à la main.
- Une matrice de 2 pour valider le sharding sans saturer les runners.

## Matrice

| Forme                  | Stacks/runner | RAM estimée | Verdict                 |
| ---------------------- | ------------- | ----------- | ----------------------- |
| ★ 2 runners × 1 worker | 1             | ok          | Retenu                  |
| 2 runners × 2 workers  | 2             | serrée      | 8 .NET par runner       |
| 1 runner × 2 workers   | 2             | serrée      | Ne teste pas la matrice |

`E2E_RUNNERS: '2'`, `E2E_WORKERS: '1'` dans le workflow, lus par le planner.

## Scripts ★ Python

Dans `frontend-game/scripts/e2e/` (stdlib seule) :

| Script            | Rôle                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `config.py`       | Chemins, ports (front 3000, Traefik 8088, Keycloak 8081), liste des services, `HEALTH_TIMEOUT = 240`                                 |
| `spec_planner.py` | Bin-packing des specs par nombre de `it(`, en lanes séparées par `\|`. Imprime la matrice JSON lue par la CI                         |
| `servers.py`      | `docker compose up -d --wait <services>` détaché, attente des healthchecks, password grant Keycloak, `node .output/server/index.mjs` |
| `e2e_parallel.py` | Deux étapes, `backends` puis `tests` ; un Cypress par lane                                                                           |

Les étapes sont séparées pour le parallélisme : `backends` démarre la stack en arrière-plan
**pendant** que le runner installe Node et Cypress, puis `tests` attend les health checks
(`docker compose ps`) et lance Cypress.

Cypress reçoit `baseUrl=http://localhost:3000/game` (le jeu est servi sous `app.baseURL`
`/game/`) et `--env gatewayUrl=http://localhost:8088,keycloakUrl=http://localhost:8081`, pour
les setups par API.

## Workflow (`ci.yml`)

```
quality ─┬─ e2e-plan ───────────┐
         ├─ e2e-build (Nuxt) ───┼─ e2e (matrix 2) ── upload cypress-results-runner-N
         └─ e2e-build-backends ─┘
```

Le job `e2e` actuel (build et start dans le même job) est remplacé.

## Specs

- `shell.cy.ts` : conservée (harness, axe, rendu sans JS).
- `play-solo-run.cy.ts` (nouvelle) : `/players/<id>/play`, création d'un lobby solo
  (`PlayerHub`), lancement du run (`DungeonHub`), première salle visible. Elle traverse player,
  dungeon et combat derrière Traefik.
- Les autres parcours restent aux squads qui livrent les routes (ADR-FE-012 : suite
  volontairement petite).
- Avec 2 specs et 2 runners, chaque runner en prend une. Le sharding est prouvé, pas encore
  rentable.

## Réserves

- En local, Cypress 15.21 avec Chrome 158 headless plante quand un même run enchaîne plusieurs
  specs (`* is not a valid URL`). Avec 1 spec par lane, la CI n'est pas concernée. À revoir si
  une lane reçoit plusieurs specs.

## Sources

- `frontend-game/scripts/e2e/`
- `frontend-game/.github/workflows/ci.yml`
