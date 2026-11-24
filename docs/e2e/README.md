# E2E full stack : Cypress derrière le gateway

**But** : faire tourner Cypress sur le jeu branché aux vrais micro-services derrière Traefik
(player, combat, dungeon, reward, sans leaderboard), avec des specs réparties sur une matrice de
2 runners, une stack démarrée en arrière-plan et des health checks avant les tests.

Décidé le 2026-11-24. Aujourd'hui, le job `e2e` de `ci.yml` ne lance que le build Nuxt et
`shell.cy.ts`, sans aucun backend.

## Choix retenus

| Sujet               | Choix                                                                                        | Fiche                            |
| ------------------- | -------------------------------------------------------------------------------------------- | -------------------------------- |
| Services            | traefik, keycloak, postgres, rabbitmq, player, combat, dungeon, reward. **Pas leaderboard.** | [stack.md](stack.md)             |
| Source des backends | Build depuis les sources (`Dockerfile.dev`, repos publics, aucun secret)                     | [stack.md](stack.md)             |
| Partage des images  | Un job `e2e-build-backends` : `docker save`, artefact, puis `docker load` sur chaque runner  | [stack.md](stack.md)             |
| Front               | Build Nuxt sur l'hôte, `node .output/server/index.mjs` sur :3000                             | [stack.md](stack.md)             |
| Matrice             | 2 runners × 1 worker                                                                         | [sharding.md](sharding.md)       |
| Orchestration       | Scripts Python dans `scripts/e2e/` (planner, boot, health checks, Cypress par lane)          | [sharding.md](sharding.md)       |
| Identité            | Vrai Keycloak : un user par test (API admin + password grant), tokens en sessionStorage      | [identite.md](identite.md)       |
| Specs de départ     | `shell.cy.ts` + 1 parcours réel (play → lobby solo → run de donjon)                          | [sharding.md](sharding.md#specs) |

## Fiches

- [stack.md](stack.md) : quels services, comment ils sont buildés, servis et attendus.
- [sharding.md](sharding.md) : planner, matrice, scripts, health checks, specs.
- [identite.md](identite.md) : comment Cypress s'authentifie auprès du vrai Keycloak.
- [piste-images.md](piste-images.md) : Harbor, self-hosted et GHCR, non retenus.
- [piste-identite-par-test.md](piste-identite-par-test.md) : identité fixe, header par test, plugin cookie et login UI, non retenus.

## Glossaire

- **Runner** : une machine de la matrice GitHub Actions (`ubuntu-latest`).
- **Worker** : une instance Cypress avec sa propre stack. Ici, 1 par runner.
- **Lane** : la liste de specs d'un worker, calculée par le planner.
- **Password grant** : obtention d'un token Keycloak par identifiant et mot de passe, sans passer par la page de login. Activé seulement sur la stack E2E.

## En local

Lancer la suite en local : voir [local-stack.md](../local-stack.md#tests-end-to-end).
