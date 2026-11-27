[← README](README.md)

# Identité en E2E

Révisé le 2026-11-24. Keycloak est arrivé sur `dev` : la décision « identité fixe posée par
Traefik » est remplacée, voir [piste-identite-par-test.md](piste-identite-par-test.md).

## Le contexte

- La stack locale lance Keycloak (`quay.io/keycloak/keycloak`, `start-dev --import-realm`,
  realm `lantern`, sur `localhost:8081`).
- Traefik valide le JWT avec le plugin `agilezebra/jwt-middleware` (middleware `authenticated`).
  Il exige `azp: lantern-public`, mappe `sub` vers `X-User-Id`, et lit le token dans
  `Authorization` **ou** dans `?access_token=` (`parameterName`), ce qui couvre le WebSocket.
- Le front envoie `Authorization: Bearer` en HTTP et `access_token` dans l'URL du WS
  (`signalRHubClient.ts`). Il restaure sa session depuis
  `sessionStorage["lantern.keycloak.tokens"]` (`plugins/keycloak.client.ts`).
- Le client `lantern-public` a `directAccessGrantsEnabled: false`.

## Critères

- Le vrai JWT, validé par le vrai gateway, en HTTP et en WebSocket.
- Un joueur par test : aucun état partagé entre specs, et la voie reste ouverte à plusieurs
  workers par runner.
- Le realm versionné n'est pas modifié.

## Options

| Option                                        | Vrai JWT | WS  | Isolation par test | Coût                                    |
| --------------------------------------------- | -------- | --- | ------------------ | --------------------------------------- |
| ★ API admin + password grant + sessionStorage | oui      | oui | oui                | 1 PUT admin au boot, 1 commande Cypress |
| Login UI via `cy.origin`                      | oui      | oui | oui                | Lent, dépend du thème Keycloak          |
| Identité fixe posée par Traefik               | non      | oui | non                | Un overlay, l'auth n'est plus testée    |

## Choix ★

1. **Au boot** (`scripts/e2e`, étape `backends`), une fois Keycloak sain : un token admin
   (`master`, `admin-cli`, `admin`/`admin` par défaut), puis un `PUT` sur le client
   `lantern-public` avec `directAccessGrantsEnabled: true`. Le réglage est fait au runtime,
   seulement sur la stack E2E. Le fichier `keycloak/realm/lantern-realm.json` ne change pas.
2. **`cy.login()`** (`cypress/support`) :
   - crée un utilisateur unique (`e2e-<uuid>`, mot de passe fixe) avec l'API admin ;
   - récupère `access_token`, `refresh_token` et `id_token` par `grant_type=password` sur
     `lantern-public` ;
   - les écrit dans `sessionStorage["lantern.keycloak.tokens"]` en `onBeforeLoad` du premier
     `cy.visit`. `keycloak.init` restaure alors la session et le middleware `auth.global`
     laisse passer.
3. Player crée le joueur à la première requête (`CurrentPlayerResolver`), donc pas de setup
   joueur.

## Réserves

- **Durée de vie du token** : un `access_token` Keycloak dure 5 min par défaut, et le front le
  rafraîchit avec le `refresh_token`. C'est largement suffisant pour une spec.
- **L'issuer** du JWT est `http://localhost:8081/realms/lantern`. Le password grant doit donc
  viser `localhost:8081`, pas `keycloak:8080`, sinon Traefik rejette le token.
- Le réglage `directAccessGrants` ne doit **jamais** être appliqué hors stack E2E. Seul le
  script E2E le pose.

## Sources

- `frontend-game/deploy/traefik/backend/routes.yaml` (middlewares `authenticated`,
  `keycloak-jwt`)
- `frontend-game/compose.backend.yaml` (service `keycloak`, plugin Traefik)
- `frontend-game/keycloak/realm/lantern-realm.json`
- `frontend-game/app/plugins/keycloak.client.ts`, `app/middleware/auth.global.ts`,
  `app/shared/api/signalRHubClient.ts`
- `player-backend/Player.Presentation/Authentication/CurrentPlayerResolver.cs`
