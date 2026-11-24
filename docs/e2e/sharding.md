[← README](README.md)

# Sharding et orchestration

## Critères

- Même mécanique que Mawster, pour ne maintenir qu'un seul modèle mental.
- Une matrice de 2 pour valider le sharding sans saturer les runners.

## Matrice

| Forme                  | Stacks/runner | RAM estimée | Verdict                                             |
| ---------------------- | ------------- | ----------- | --------------------------------------------------- |
| ★ 2 runners × 1 worker | 1             | ok          | Retenu                                              |
| 2 runners × 2 workers  | 2             | serrée      | 8 .NET par runner, et l'identité fixe ne tient plus |
| 1 runner × 2 workers   | 2             | serrée      | Ne teste pas la matrice                             |

`E2E_RUNNERS: '2'`, `E2E_WORKERS: '1'` dans le workflow, lus par le planner.

## Scripts ★ Python, portés de Mawster

Dans `frontend-game/scripts/e2e/` :

| Mawster           | Lantern                                                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config.py`       | `FRONT_DIR` = racine du repo, `GATEWAY_PORT = 8088`, `FRONT_PORT = 3000`, `HEALTH_TIMEOUT = 240`                                                                 |
| `spec_planner.py` | Repris tel quel : bin-packing par nombre de `it(`, lanes séparées par `\|`. Sans le filtre vision.                                                               |
| `servers.py`      | `start_backend` → `docker compose up -d --wait <services>` ; `start_frontend` → `node .output/server/index.mjs`. Plus de static server, plus de base par worker. |
| `e2e_parallel.py` | Mêmes étapes `backends` et `tests`. `npx cypress run` au lieu de `pnpm exec`.                                                                                    |
| `report.py`       | Repris tel quel (rapport fusionné dans `cypress/results`)                                                                                                        |

Les étapes restent séparées pour garder le parallélisme de Mawster : `backends` démarre la stack
en arrière-plan **pendant** que le runner installe Node et Cypress, puis `tests` attend les
health checks et lance Cypress.

Cypress reçoit `baseUrl=http://localhost:3000` et `--expose gatewayUrl=http://localhost:8088`,
pour les setups par API.

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

## Plan d'implémentation

1. `deploy/traefik/e2e/` : l'overlay d'identité ([identite.md](identite.md)) et un
   `compose.e2e.yaml` qui monte cet overlay sur traefik.
2. `scripts/e2e/` : le portage Python. Vérifier en local avec les deux étapes de
   `e2e_parallel.py` (`backends` puis `tests`).
3. `play-solo-run.cy.ts`, avec des sélecteurs `data-cy` et un nom de héros unique.
4. `ci.yml` : les jobs `e2e-plan`, `e2e-build`, `e2e-build-backends` et `e2e` (matrix).
5. Mettre à jour [local-stack.md](../local-stack.md) avec la commande E2E locale.

## Sources

- `Mawster/scripts/e2e/{config,spec_planner,e2e_parallel,servers,report}.py`
- `Mawster/.github/workflows/_test.yaml`
- `frontend-game/.github/workflows/ci.yml`
