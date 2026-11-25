# Stack locale Docker Compose

Voir aussi le [contrat de configuration des communications](communications-configuration.md).

Le fichier `compose.yaml` de `frontend-game` lance douze conteneurs : les deux
fronts Nuxt, Player, Combat, Dungeon, Reward, Leaderboard, Traefik, PostgreSQL
et RabbitMQ. Il assemble les dépôts indépendants sans déplacer leurs sources.

## Démarrage

Docker Desktop doit utiliser les conteneurs Linux. Docker Compose v2.33 ou
supérieur convient. Cloner les sept dépôts côte à côte :

```text
P1-2/
  frontend-game/       # compose.yaml et deploy/
  frontend-public/
  player-backend/
  combat-backend/
  dungeon-backend/
  reward-backend/
  leaderboard-backend/
```

Depuis `frontend-game` :

```sh
docker compose config --quiet
docker compose up -d --build --wait --wait-timeout 240
docker compose ps
```

| Accès       | URL par défaut        |
| ----------- | --------------------- |
| Jeu         | http://localhost:3000 |
| Site public | http://localhost:3001 |
| Keycloak    | http://localhost:8081 |

Ces deux ports appartiennent à Traefik et sont publiés uniquement sur
`127.0.0.1`. Les microservices, PostgreSQL, RabbitMQ et gRPC ne publient aucun
port sur l'hôte. Le réseau `backend` est interne ; les fronts utilisent un
réseau `web` distinct et Traefik rejoint les deux.

### Authentification locale

Keycloak est un service de la stack locale. Il démarre en mode développement,
importe automatiquement `keycloak/realm/lantern-realm.json` et monte le thème
`keycloak/themes/lantern`. Aucune importation manuelle de realm ni copie de
thème dans un conteneur n'est nécessaire.

Le client public `lantern-public` est configuré pour le jeu sur
`http://localhost:3000`. Le front Game est construit avec
`NUXT_PUBLIC_KEYCLOAK_URL=http://localhost:8081` et attend que Keycloak soit
en bonne santé avant son démarrage. Les identifiants locaux sont :

| Usage                   | Identifiant | Mot de passe |
| ----------------------- | ----------- | ------------ |
| Joueur de démonstration | `demo`      | `demo`       |
| Administration Keycloak | `admin`     | `admin`      |

Les variables `KEYCLOAK_PORT`, `KEYCLOAK_ADMIN` et
`KEYCLOAK_ADMIN_PASSWORD` figurent dans `.env.compose.example`. Les valeurs
par défaut sont exclusivement locales ; les modifier avant toute exposition de
la stack. La documentation détaillée est dans
[`app/features/auth/readme.md`](../app/features/auth/readme.md).

Traefik valide cryptographiquement les access tokens via son plugin JWT. Il
vérifie la signature RS256 depuis le JWKS Keycloak, l'émetteur et le client
`lantern-public`, puis transmet les headers d'identité de confiance
`X-User-Id` et `X-Username` aux APIs. Les headers correspondants fournis par
un client sont supprimés avant la validation. Le plugin est téléchargé au
démarrage de Traefik : le premier lancement nécessite donc un accès réseau.

Il n'y a pas de port API supplémentaire dans le Compose complet : les appels
`http://localhost:3000/api/v1/...` arrivent déjà sur Traefik, qui les envoie au
microservice concerné. Les autres chemins vont au front.

### Variante sans les fronts

`compose.backend.yaml` démarre uniquement les cinq backends, PostgreSQL,
RabbitMQ et Traefik. Il ne construit et ne lance aucun front :

```sh
docker compose -f compose.backend.yaml up -d --build --wait --wait-timeout 240
```

Dans cette variante, Traefik est publié sur `http://localhost:8088`
(`API_PORT`) et Keycloak sur `http://localhost:8081` (`KEYCLOAK_PORT`). Les
ports `3000` et `3001` restent libres pour les serveurs Nuxt
lancés sur l'hôte. Dans le `.env` de chaque front local, utiliser :

```dotenv
NUXT_PUBLIC_API_GATEWAY_URL=http://localhost:8088
NUXT_PUBLIC_KEYCLOAK_URL=http://localhost:8081
NUXT_PUBLIC_KEYCLOAK_REALM=lantern
NUXT_PUBLIC_KEYCLOAK_CLIENT_ID=lantern-public
```

Lancer ensuite les fronts avec `npm run dev`, sur `3000` pour le jeu et `3001`
pour le site public (`npm run dev -- --port 3001`). Traefik autorise ces deux
origines via CORS, notamment les requêtes de négociation SignalR. Adapter
`GAME_PORT` et `PUBLIC_PORT` si les serveurs locaux utilisent d'autres ports.

Le Compose complet réutilise les définitions de `compose.backend.yaml` via
`extends`. Les deux modes partagent le projet `lantern-local` et ses volumes ;
ce sont deux façons de lancer la même stack, pas deux stacks simultanées.
Pour changer de mode, arrêter le mode courant avec sa commande `down`, sans
`--volumes`, puis lancer l'autre. Exemple depuis le mode complet :

```sh
docker compose down
docker compose -f compose.backend.yaml up -d --build --wait
```

Pour changer les ports ou les identifiants locaux, copier `.env.compose.example`
en `.env.compose`, puis ajouter `--env-file .env.compose` à **toutes** les commandes
Compose. Ce fichier est ignoré par Git. Les valeurs par défaut permettent un
démarrage immédiat et sont exclusivement destinées au développement local.
Les mots de passe de base inclus dans les chaînes Npgsql doivent éviter `;`
et les guillemets ; utiliser une valeur alphanumérique pour cette stack.

## Routage HTTP et SignalR

Les fronts reçoivent `NUXT_PUBLIC_API_GATEWAY_URL=/` à l'exécution. Le
navigateur appelle ainsi `/api/v1/...` et `/hubs/player` sur l'origine du
front, toujours via Traefik, sans CORS ni proxy Nuxt. Les éventuels futurs
appels SSR devront utiliser une URL interne absolue de Traefik, car `/` vise
ici les appels du navigateur.

La configuration commune des API se trouve dans `deploy/traefik/backend/routes.yaml`.
Le mode complet charge aussi `deploy/traefik/frontends.yaml`. Elle utilise le
[provider fichier Traefik](https://doc.traefik.io/traefik/v3.6/reference/routing-configuration/other-providers/file/)
et les noms DNS Compose, sans monter le socket Docker.

Après modification des fichiers de routage, utiliser
`docker compose -f compose.backend.yaml restart traefik` (ou `docker compose
restart traefik` en mode complet). Docker Desktop peut ne pas transmettre les
notifications de changement des fichiers montés depuis Windows.

| Route native, via les ports Traefik du mode choisi                    | Service                                   |
| --------------------------------------------------------------------- | ----------------------------------------- |
| `/api/player/v1/hero-classes[/...]`, `/api/player/v1/me/heroes[/...]` | Player                                    |
| `/hubs/player[/...]` (négociation et WebSocket)                       | Player                                    |
| `/api/v1/monster-types[/...]`, `/api/v1/heroes/{id}/combat-data`      | Combat                                    |
| `/hubs/combats[/...]`                                                 | Combat                                    |
| `/hubs/dungeons[/...]`                                                | Dungeon                                   |
| `/api/player/v1/...`                                                  | Player, route native sans réécriture      |
| `/api/v1/rewards/...`, `/api/rewards/...`                             | Rewards, préfixe remplacé par `/api/v1`   |
| `/api/leaderboard/v1/...`                                             | Leaderboard, route native sans réécriture |
| `/api/v1/heroes/{id}/inventory[/...]`                                 | Reward                                    |
| `/services/{service}/...`                                             | Service nommé, préfixe retiré             |

`service` vaut `player`, `combat`, `dungeon` ou `reward`.
Par exemple, `/services/dungeon/health/ready` devient `/health/ready` dans
Dungeon. Ces préfixes locaux donnent accès à quatre services sans collision :
Dungeon expose encore des contrôleurs de template
`/api/v1/players`. Les routes de diagnostic préfixées ne constituent pas un
nouveau contrat d'API de production. Les URLs natives du front restent intactes.

### Que signifie `http://reward:8080` ?

`reward` est le nom du service dans Compose. Le DNS interne de Docker traduit
ce nom en adresse IP du conteneur Reward, et `8080` est le port HTTP où écoute
l'application .NET **dans ce conteneur**. Traefik et Reward partagent le réseau
`backend`, donc Traefik peut utiliser cette URL sans publier le port de Reward.
Le navigateur de l'hôte utilise une URL de Traefik, pas le nom interne `reward`.
Plusieurs conteneurs peuvent écouter sur `8080`, chacun ayant sa propre adresse.

Keycloak est également accessible depuis les deux origines des fronts sous
`/auth`. Traefik retire ce préfixe avant de transmettre la requête au Keycloak
local, qui est monté à sa racine. Les pages pré-rendues peuvent donc utiliser
la valeur portable `NUXT_PUBLIC_KEYCLOAK_URL=/auth` en Compose comme en
production.

### Configuration Nuxt au démarrage

L'image du jeu ne reçoit aucune URL publique pendant sa construction. Les
variables `NUXT_PUBLIC_*` sont fournies à l'exécution par Compose ou Kubernetes
et Nuxt les injecte dans les réponses SSR/CSR. La même image est donc portable
entre les environnements.

Le crawl de pré-rendu est désactivé pour ne pas transformer les routes
interactives en HTML statique contenant une configuration obsolète. Une future
route statique doit explicitement déclarer `prerender: true` et utiliser les
valeurs portables par défaut : Gateway `/` et Keycloak `/auth`.

La configuration suit les dépendances cibles : Player → Dungeon ; Dungeon →
Combat et Rewards ; Combat → Player, Rewards et Dungeon. Chaque adresse gRPC
utilise le port interne 8081 et possède un timeout configurable. Reward et
Progression n'ont pas de dépendance gRPC sortante dans cette matrice.
Les anciennes variables communes `Grpc__Player__Address` et les paramètres
Placeholder ont été retirés du Compose.

Les noms fonctionnels « Rewards » et « Progression » correspondent aux services
Compose `reward` et `leaderboard`. Les noms existants des bases et volumes
restent identiques. Les exchanges cibles sont `player.events`, `dungeon.events`,
`combat.events`, `rewards.events` et `progression.events`.

La topologie RabbitMQ est importée automatiquement via un hook Compose après
le démarrage normal du broker : les utilisateurs existants sont conservés.
Les backends attendent la fin de cet import avant de démarrer. Les bindings
et la politique de redélivrance figurent dans
`deploy/rabbitmq/definitions.json`. Les files Player, Rewards et Progression
sont préconfigurées ; celle de Progression et ses 15 bindings restent réservés
à un futur consommateur. Leaderboard déclare sa propre file
`leaderboard.raw-events` et sa file de rejet au démarrage. Toutes sont durables.
Modifier la topologie puis recréer le broker
(`docker compose -f compose.backend.yaml up -d --force-recreate rabbitmq`)
réimporte les définitions sans supprimer le volume.

## Données et disponibilité

Un seul PostgreSQL 17 possède cinq bases applicatives : `player`, `combat`,
`dungeon`, `reward` et `leaderboard`. Chaque base appartient à un rôle du même
nom, non superutilisateur. Les droits de connexion publics sont retirés pour
éviter qu'un rôle applicatif accède à la base d'un autre service. PostgreSQL
conserve également ses bases système habituelles.

`deploy/postgres/01-create-databases.sh` initialise les rôles et les bases au
premier démarrage. L'image PostgreSQL ne crée qu'une base applicative via
`POSTGRES_DB` ; la boucle du script crée les cinq bases demandées, leurs cinq
utilisateurs, puis retire les droits de connexion publics. Les migrations .NET
créent ensuite les tables à l'intérieur de chaque base. Il ne s'agit pas d'une
commande `make` : PostgreSQL exécute automatiquement le script monté dans
`/docker-entrypoint-initdb.d`. Comme le précise l'[image officielle PostgreSQL](https://hub.docker.com/_/postgres),
les scripts d'initialisation ne sont exécutés que sur un volume vide.
Changer les variables de mot de passe ne modifie donc pas les rôles existants.
Le même principe s'applique aux identifiants initiaux RabbitMQ. MongoDB 8
fonctionne en replica set local `rs0` pour le magasin d'événements bruts de
Leaderboard, avec un volume `mongo-data` dédié.

Les backends attendent PostgreSQL et RabbitMQ en bonne santé ; Leaderboard
attend aussi MongoDB. Ils appliquent ensuite
leurs migrations et données de développement via leur démarrage existant
(`ASPNETCORE_ENVIRONMENT=Development`). Chaque API et front possède un contrôle
HTTP ; Traefik vérifie aussi les destinations. `/health/ready` reste le contrôle
existant des backends, qui ne teste pas toutes leurs dépendances métier.
L'image minimale de Leaderboard ne contient pas de shell : son contrôle Compose
appelle `Leaderboard.Presentation.dll --healthcheck`, qui interroge
`/health/ready`. Traefik vérifie aussi cette route.

Les volumes `postgres-data`, `rabbitmq-data` et `mongo-data` persistent après un arrêt :

```sh
docker compose logs --tail=100 player traefik
docker compose down
```

Pour une remise à zéro **avec suppression de toutes les données de cette stack**,
utiliser `docker compose down --volumes`, puis relancer la stack. Cette commande
ne doit pas être utilisée pour un simple redémarrage.

## Vérification

```sh
curl http://localhost:3000/healthz
curl http://localhost:3001/healthz
curl http://localhost:3000/api/player/v1/hero-classes
curl http://localhost:3000/services/player/health/ready
curl http://localhost:3000/services/combat/health/ready
curl http://localhost:3000/services/dungeon/health/ready
curl http://localhost:3000/services/reward/health/ready
curl -X POST "http://localhost:3000/hubs/player/negotiate?negotiateVersion=1"
```

Sous Windows PowerShell, utiliser `curl.exe` pour ces commandes.
En mode sans fronts, utiliser `http://localhost:8088` pour les vérifications
API/SignalR ; les deux endpoints frontend `/healthz` ne sont pas disponibles.

## Tests end-to-end

La suite Cypress tourne contre la variante sans les fronts : Traefik, Keycloak,
PostgreSQL, RabbitMQ, Player, Combat, Dungeon et Reward. Leaderboard n'est ni
construit ni démarré. Le jeu est servi depuis son build Nuxt sur le port 3000.
Les décisions sont dans [e2e/README.md](e2e/README.md).

Depuis `frontend-game`, avec Python 3.12 (`py` sous Windows) :

```sh
docker compose -f compose.backend.dev.yaml build player combat dungeon reward
npm run build
python3 scripts/e2e/e2e_parallel.py backends
python3 scripts/e2e/e2e_parallel.py tests --spec cypress/e2e/play-solo-run.cy.ts
```

Pour voir les tests tourner dans le navigateur, `open` remplace `tests` : il prépare
la même stack puis ouvre l'application Cypress, où l'on choisit la spec à lancer.

```sh
python3 scripts/e2e/e2e_parallel.py backends
python3 scripts/e2e/e2e_parallel.py open
```

- `backends` lance la stack en arrière-plan et rend la main tout de suite ;
  `tests` attend que les huit services soient sains, active le password grant
  sur le client `lantern-public` (stack E2E uniquement), démarre le front puis
  Cypress.
- Ports : front 3000 (jeu sous `/game/`), Traefik 8088, Keycloak 8081.
- Chaque test crée son propre utilisateur Keycloak : aucune base n'est vidée.
  Pour repartir de zéro : `docker compose -f compose.backend.dev.yaml down -v`.
- Logs : `cypress/results/workers/worker-0/` (`backend.log`, `frontend.log`,
  `cypress.log`) et captures dans `cypress/results/screenshots/`.
- Sous Windows, le front démarré par `tests` survit au script : libérer le
  port 3000 avant un nouveau run.
- En local, lancer une spec à la fois : Chrome headless plante quand un même
  run enchaîne plusieurs specs.

## Portée et écarts actuels

- ADR-GLOB-002, 003, 005 et 010 : RabbitMQ, entrée unique, bases possédées par
  service et transports HTTP/SignalR/gRPC sont représentés dans cette stack.
  ADR-FE-007 : les deux fronts restent des dépôts et images indépendants.
- ADR-GLOB-004 est appliqué à la stack locale : Traefik valide les access
  tokens Keycloak par son plugin JWT et injecte les headers d'identité de
  confiance. Les microservices ne valident pas le JWT externe.
  HTTPS et une gestion de secrets adaptée restent nécessaires avant tout
  déploiement partagé ou de production.
- Les adresses, abonnements et paramètres de résilience décrivent la cible des
  ADR. Les adaptateurs gRPC, consommateurs, outbox et instrumentation encore
  absents ne sont pas implémentés par ce travail. Le démarrage de la stack
  n'est pas un test de bout en bout des parcours métier.
- Chaque backend utilise désormais son propre Dockerfile. Leaderboard restaure
  systématiquement `Combat.Contracts` depuis GitHub Packages. Le build de
  `frontend-public` reste dans
  `deploy/frontend-public.Dockerfile`.

## Packages de contrats : local et GitHub

Les commandes Compose locales construisent `Dungeon.Contracts` pour Player et
`Combat.Contracts` pour Leaderboard depuis les sources des backends frÃ¨res.
Elles ne demandent donc pas `GITHUB_PACKAGES_CREDENTIALS`. Les instructions
d'authentification ci-dessous concernent seulement un build Docker standard,
utilisÃ© en CI et en production.

Les cinq backends ont un `NuGet.config` avec la source GitHub de l'organisation
et une sélection explicite des packages de contrats. Les jetons sont transmis
par secret BuildKit, jamais par ARG ni ENV persistant.

Définir `GITHUB_PACKAGES_CREDENTIALS` dans
le shell au format `Username=<login>;Password=<token>;ValidAuthenticationTypes=Basic`,
avec un jeton ayant accès aux packages, puis lancer :

```sh
docker compose -f compose.backend.yaml up -d --build --wait
```

Pour la stack complète, utiliser `docker compose up -d --build --wait` avec la
même variable d'environnement. Leaderboard ne construit ni ne lit les sources
locales du contrat Combat ; il restaure uniquement la version référencée par
`PackageReference`.
