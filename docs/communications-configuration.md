# Contrat de configuration des communications

Ce document applique la matrice de
[`player-backend/docs/architecture/ARCHITECTURE_DES_COMMUNICATIONS_MICROSERVICES.fr.md`](../../player-backend/docs/architecture/ARCHITECTURE_DES_COMMUNICATIONS_MICROSERVICES.fr.md)
et les ADR-GLOB-002, 003, 004, 006, 007, 008, 009 et 011.
Le complément métier Combat sur les PV/mana ne modifie pas les dépendances réseau.

Les noms Compose restent `player`, `dungeon`, `combat`, `reward`, `leaderboard`.
Rewards désigne `reward` ; Progression désigne `leaderboard`.
Cette configuration anticipe les implémentations. Elle ne crée aucun client
gRPC, Hub, consommateur RabbitMQ, outbox ni SDK de télémétrie.

## Matrice gRPC cible

| Appelant | Configuration            | Destination           | Opérations                                    |
| -------- | ------------------------ | --------------------- | --------------------------------------------- |
| Player   | `Grpc__Dungeon__Address` | `http://dungeon:8081` | CreateDungeonRun, AbandonDungeonRun           |
| Dungeon  | `Grpc__Combat__Address`  | `http://combat:8081`  | CreateCombat                                  |
| Dungeon  | `Grpc__Rewards__Address` | `http://reward:8081`  | GrantChestReward                              |
| Combat   | `Grpc__Player__Address`  | `http://player:8081`  | GetCombatantSnapshot                          |
| Combat   | `Grpc__Rewards__Address` | `http://reward:8081`  | GetCombatInventorySnapshot, GrantCombatReward |
| Combat   | `Grpc__Dungeon__Address` | `http://dungeon:8081` | ReportCombatResult                            |

Reward et Progression n'ont pas d'appel gRPC sortant dans la cible.
Les adresses du tableau sont injectées uniquement chez les appelants concernés.
Chaque dépendance possède `Grpc__<Service>__TimeoutSeconds` (5 secondes).
Les six variables de surcharge sont dans `.env.compose.example`.
Les noms des sections nouvelles prolongent la convention `Grpc:Player` existante.

Pour ces appelants, les clés nouvelles
`Grpc__Resilience__Retry__MaxAttempts=1`,
`Grpc__Resilience__CircuitBreaker__FailureThreshold=5`,
`Grpc__Resilience__CircuitBreaker__BreakDurationSeconds=30` sont fournies.
Ce sont des conventions et valeurs locales, pas des seuils prescrits par les ADR.
Le futur code doit les appliquer ; leur présence seule n'active pas un circuit
breaker. Un retry requiert une opération rejouable, un `CommandId` conservé
et une erreur transitoire. Aucun retry métier n'est ajouté à Traefik.

Les flags existants `ExternalServices__Player__IsMockFallbackEnabled` et
`ExternalServices__Rewards__IsMockFallbackEnabled` sont à `false` pour Combat :
une dépendance obligatoire ne doit pas être remplacée par des données simulées.
Les adaptateurs toujours enregistrés comme mocks dans le code restent à remplacer
par les équipes ; ce travail ne modifie pas leur enregistrement.

## Entrées HTTP et SignalR

- Player : `/api/v1/player/...` et alias documentaire `/api/player/...`.
- Rewards : `/api/v1/rewards/...` et `/api/rewards/...`.
- Progression : `/api/v1/progression/...` et `/api/progression/...`.
- Hubs : `/hubs/player`, `/hubs/dungeons`, `/hubs/combats`.

Le préfixe propriétaire est remplacé par `/api/v1` côté backend, conformément
au versionnement des contrôleurs. Exemple :
`/api/v1/player/hero-classes` → Player `/api/v1/hero-classes`.
C'est la convention de réécriture locale pour les chemins abstraits des docs.
Les routes natives actuelles restent routées, dont `/api/v1/players/...`,
les routes Dungeon et l'inventaire Reward.
`/services/<service>/...` reste un accès de diagnostic local.
Le code du backend doit implémenter la route finale ; Traefik ne crée pas de Hub.

Le port HTTP interne est 8080 (`Http1`), gRPC est sur 8081 (`Http2`).
`Kestrel__Endpoints__Http__Url/Protocols` et
`Kestrel__Endpoints__Grpc__Url/Protocols` sont injectés explicitement.
Seul Traefik publie des ports sur l'hôte.
`Cors__AllowedOrigins__0` et `__1` sont fournis à tous les backends ;
Traefik applique aussi la liste d'origines locale.

## RabbitMQ : producteurs et consommateurs

Connexion commune : `RabbitMq__Enabled=true`, `HostName=rabbitmq`,
`Port=5672`, `VirtualHost=/`, `UserName=lantern`, `Password`.
Le mot de passe provient de `RABBITMQ_PASSWORD`.

| Service     | Exchange publié                | File consommée          |
| ----------- | ------------------------------ | ----------------------- |
| Player      | `player.events`                | `player.events.v1`      |
| Dungeon     | `dungeon.events`               | Aucune dans la matrice  |
| Combat      | `combat.events`                | Aucune dans la matrice  |
| Rewards     | `rewards.events`               | `rewards.events.v1`     |
| Progression | `progression.events` (réservé) | `progression.events.v1` |

Player consomme `dungeon.dungeon-run-ended.v1`.
Rewards consomme `combat.consumable-used.v1`.
Progression consomme les 15 clés statistiques explicitement listées dans le
catalogue, indépendamment des autres files. Aucun wildcard ne lui livre les
événements techniques ou non statistiques.

Les futurs consommateurs lisent `RabbitMq__QueueName`, `PrefetchCount`,
`DeadLetterExchangeName`, `DeadLetterQueueName`,
`Subscriptions__N__ExchangeName` et `Subscriptions__N__RoutingKey`.
Les mêmes noms apparaissent dans les `appsettings.json` concernés et dans
`deploy/rabbitmq/definitions.json`.

Le hook `post_start` importe la topologie après la création habituelle des
utilisateurs RabbitMQ ; il ne remplace ni mots de passe ni permissions.
Le hostname du broker est fixé à `rabbitmq` pour conserver le même nom de nœud
et le même répertoire de données lors d'une recréation du conteneur.
Le healthcheck reste en attente jusqu'à la fin de cet import.
Les files sont des quorum queues durables. Politique locale :
limite de redélivrance 5, expiration après 7 jours, puis dead-letter vers
`lantern.dead-letter` et la file `<file>.dead`.
La dead-letter utilise la stratégie `at-least-once` et
`overflow=reject-publish`. Les DLQ n'expirent pas automatiquement.
Ces seuils restent des choix locaux, pas des constantes métier.
Un consommateur doit acquitter après succès, dédupliquer et décider quand
rejeter/rejouer ; le broker n'implémente pas cette logique applicative.

## Configuration, traces et identité

Chaque service reçoit sa propre chaîne `ConnectionStrings__DefaultConnection`.
`LOG_LEVEL` alimente `Serilog__MinimumLevel__Default`.

Les variables standard OpenTelemetry sont préparées :
`OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES`, `OTEL_SDK_DISABLED`,
`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_PROTOCOL`,
`OTEL_TRACES_EXPORTER`, `OTEL_METRICS_EXPORTER`,
`OTEL_LOGS_EXPORTER`, `OTEL_TRACES_SAMPLER`.
Le SDK est désactivé par défaut ; `otel-collector:4317` est une adresse
réservée, pas un service lancé ici. Pour activer l'export, intégrer le SDK et
raccorder un collecteur au réseau interne ou fournir une destination joignable.
Le stockage/visualisation n'est pas choisi par ADR-GLOB-009.

Conformément à ADR-GLOB-004, pas de secrets OAuth ni de validation JWT dans
les microservices. Keycloak et la validation à la gateway restent une intégration
distincte : le routage local ne réalise pas l'authentification.
La propagation des claims, corrélations et traces reste à implémenter par les
composants concernés, sans ajouter de logique métier à Traefik.

## Documentation par backend

Chaque dépôt possède `docs/deployment-configuration.md`, ses paramètres cible
dans `appsettings.json`, son Dockerfile et son `NuGet.config`.
Les nouveaux paramètres gRPC, résilience, abonnements et OTEL constituent le
contrat de configuration attendu des futures implémentations. Les paramètres
déjà lus restent utilisés par les adaptateurs existants.

Voir [la stack locale](local-stack.md#packages-de-contrats-github) pour la
restauration des contrats publiés via secret BuildKit.
