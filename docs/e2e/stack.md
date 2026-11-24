[← README](README.md)

# Stack E2E : services, build, boot

## Critères

- Tester le front contre les **vrais** micro-services, routés par le **même** gateway qu'en
  local.
- Aucun secret nouveau, aucune machine à maintenir.
- Le build .NET n'est payé qu'une fois par run, pas une fois par runner.

## Services

| Service     | Dans l'E2E | Pourquoi                                                                                         |
| ----------- | ---------- | ------------------------------------------------------------------------------------------------ |
| traefik     | ★ oui      | Le gateway, avec sa config de base (`deploy/traefik/backend/`) et le plugin JWT                  |
| keycloak    | ★ oui      | Le vrai IdP, realm importé (voir [identite.md](identite.md))                                     |
| postgres    | ★ oui      | Une base par service, créée par `deploy/postgres/01-create-databases.sh`                         |
| rabbitmq    | ★ oui      | Événements entre services (dungeon → player, combat → reward)                                    |
| player      | ★ oui      | Profil, héros, lobbies, `PlayerHub`                                                              |
| combat      | ★ oui      | Monster types, combat-data                                                                       |
| dungeon     | ★ oui      | Runs, `DungeonHub`                                                                               |
| reward      | ★ oui      | Inventaire, récompenses                                                                          |
| leaderboard | **non**    | Hors scope. Les routes `/api/progression` et `/services/leaderboard` répondent 502, c'est voulu. |

On l'exclut en nommant les services : `docker compose -f compose.backend.dev.yaml up --wait
traefik keycloak postgres rabbitmq player combat dungeon reward`. On ne touche ni au compose ni
à la config Traefik partagée.

## Source des backends ★ build depuis les sources

- Les 4 repos sont **publics** : `actions/checkout` avec `repository:` et `path: ../<repo>`
  suffit, sans token.
- `compose.backend.dev.yaml` utilise les `Dockerfile.dev`, qui packent les contracts en local
  (`additional_contexts: dungeon-contracts`). Ils n'ont **pas besoin** de
  `GITHUB_PACKAGES_CREDENTIALS` (`secrets: !reset []`).
- Ref des backends : `dev`, leur branche par défaut. Le front se teste contre ce qui va sortir.

Alternatives écartées : [piste-images.md](piste-images.md).

## Partage des images ★ un job, un artefact

`e2e-build-backends` lance `docker compose -f compose.backend.dev.yaml build player combat
dungeon reward`, puis `docker save | gzip`, et publie l'artefact (`retention-days: 1`). Chaque
runner fait `docker load` et `up --no-build`. Ce job tourne en parallèle de `e2e-build` (Nuxt)
et de `e2e-plan`, comme chez Mawster.

## Front ★ sur l'hôte

- `e2e-build` lance `npm run build` et archive `.output/`.
- Le runner démarre `node .output/server/index.mjs` sur :3000 avec
  `NUXT_PUBLIC_API_GATEWAY_URL=http://localhost:8088`, ce qui correspond à la variante « sans
  les fronts » de [local-stack.md](../local-stack.md). Traefik autorise déjà l'origine
  `localhost:3000` en CORS.

## Health checks

1. `docker compose up --wait --wait-timeout 240` : les healthchecks compose existants
   (`/health/ready` de chaque service .NET et de Keycloak, `pg_isready`, la topologie RabbitMQ,
   le ping Traefik) bloquent jusqu'à ce que tout soit vert.
2. Le réglage `directAccessGrants` de Keycloak ([identite.md](identite.md)).
3. `wait_for_http` (porté de Mawster) sur `http://localhost:3000/healthz`.

Il n'y a pas de sonde à travers le gateway : toutes les routes exigent un JWT. La première spec
authentifiée sert de preuve de routage.

Le plugin JWT de Traefik est téléchargé depuis GitHub au démarrage (`experimental.plugins`).
Un runner sans accès sortant ne démarrerait pas.

## Réserves

- **RAM** : 4 services .NET + PG + RabbitMQ + Traefik + Nuxt + Chrome sur 16 Go, ça passe pour
  1 worker. À 2 workers par runner, ça doublerait, voir [sharding.md](sharding.md).
- **Temps de build** : le build .NET des 4 services, à froid, se compte en minutes.
  `docker save` sur environ 4 images aspnet se compte en centaines de Mo d'artefact. Indicatif,
  à mesurer au premier run.
- **Dérive** : si un backend casse sur `dev`, l'E2E du front devient rouge. C'est le rôle de ce
  test, mais il faudra savoir lire les logs (artefact `cypress-results-runner-N`).
- Coût : les minutes Actions sont gratuites sur un repo public (tarif GitHub au 2026-11,
  indicatif).

## Sources

- `frontend-game/compose.backend.yaml`, `compose.backend.dev.yaml`, `deploy/traefik/backend/`
- `player-backend/Dockerfile.dev`, `player-backend/.github/workflows/cd.yaml` (Harbor
  `10.4.111.200`)
- `Mawster/.github/workflows/_test.yaml` (jobs `e2e-build`, `e2e`)
