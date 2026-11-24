# E2E full stack : Cypress derrière le gateway

**But** : faire tourner Cypress sur le jeu branché aux vrais micro-services derrière Traefik
(player, combat, dungeon, reward, sans leaderboard). On reprend la mécanique de Mawster :
sharding, scripts Python, boot en arrière-plan et health checks, sur une matrice de 2 runners.

Décidé le 2026-11-24. Aujourd'hui, le job `e2e` de `ci.yml` ne lance que le build Nuxt et
`shell.cy.ts`, sans aucun backend.

## Choix retenus

| Sujet               | Choix                                                                                       | Fiche                            |
| ------------------- | ------------------------------------------------------------------------------------------- | -------------------------------- |
| Services            | traefik, postgres, rabbitmq, player, combat, dungeon, reward. **Pas leaderboard.**          | [stack.md](stack.md)             |
| Source des backends | Build depuis les sources (`Dockerfile.dev`, repos publics, aucun secret)                    | [stack.md](stack.md)             |
| Partage des images  | Un job `e2e-build-backends` : `docker save`, artefact, puis `docker load` sur chaque runner | [stack.md](stack.md)             |
| Front               | Build Nuxt sur l'hôte, `node .output/server/index.mjs` sur :3000                            | [stack.md](stack.md)             |
| Matrice             | 2 runners × 1 worker                                                                        | [sharding.md](sharding.md)       |
| Orchestration       | Python, porté depuis `Mawster/scripts/e2e`                                                  | [sharding.md](sharding.md)       |
| Identité            | Overlay Traefik e2e qui force `X-User-Id: e2e-player` (HTTP et WS)                          | [identite.md](identite.md)       |
| Specs de départ     | `shell.cy.ts` + 1 parcours réel (play → lobby solo → run de donjon)                         | [sharding.md](sharding.md#specs) |

## Fiches

- [stack.md](stack.md) : quels services, comment ils sont buildés, servis et attendus.
- [sharding.md](sharding.md) : planner, matrice, scripts, health checks, specs.
- [identite.md](identite.md) : comment Cypress est authentifié sans Keycloak.
- [piste-images.md](piste-images.md) : Harbor, self-hosted et GHCR, non retenus.
- [piste-identite-par-test.md](piste-identite-par-test.md) : header par test, plugin cookie et
  Keycloak, non retenus.

## Glossaire

- **Runner** : une machine de la matrice GitHub Actions (`ubuntu-latest`).
- **Worker** : une instance Cypress avec sa propre stack. Ici, 1 par runner.
- **Lane** : la liste de specs d'un worker, calculée par le planner.
- **Overlay e2e** : la config Traefik dynamique propre à l'E2E (`deploy/traefik/e2e/`), qui
  remplace `deploy/traefik/backend/`.

## Prochaine étape

Implémenter, avec `flow:feature`. L'ordre est donné dans [sharding.md](sharding.md#plan-dimplémentation).
