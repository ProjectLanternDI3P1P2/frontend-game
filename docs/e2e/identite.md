[← README](README.md)

# Identité en E2E

## Le problème

- En prod, le gateway valide le JWT Keycloak et pose `X-User-Id` et `X-Username`
  (ADR-GLOB-004).
- Le Traefik local (`deploy/traefik/backend/`, middleware `remove-external-identity`) **vide**
  ces headers. `CurrentPlayerResolver` (player) lève un 401 sans `X-User-Id`.
- `PlayerHub` lit `X-User-Id` sur la requête d'**upgrade WebSocket**. Un navigateur ne peut pas
  y ajouter de header, et `cy.intercept` ne voit pas les WS.
- Le front n'envoie aujourd'hui aucune identité (`getToken` n'est branché nulle part).

## Critères

- La même identité en HTTP et en WebSocket.
- Zéro code de prod modifié pour l'E2E.

## Options

| Option                             | HTTP | WS  | Isolation par test | Code à maintenir    |
| ---------------------------------- | ---- | --- | ------------------ | ------------------- |
| ★ Identité fixe posée par Traefik  | oui  | oui | non (par lane)     | 1 YAML              |
| Header par test via `cy.intercept` | oui  | non | oui                | 0                   |
| Plugin Traefik cookie → header     | oui  | oui | oui                | ~40 lignes Go       |
| Keycloak dans la stack             | oui  | ?   | oui                | realm + forwardAuth |

## Choix ★

`deploy/traefik/e2e/` est une copie de `deploy/traefik/backend/` où `remove-external-identity`
pose les valeurs au lieu de les vider :

```yaml
customRequestHeaders:
  X-User-Id: "e2e-player"
  X-Username: "E2E Player"
  X-Roles: ""
```

`X-Correlation-Id` reste vidé, comme dans la config de base.

## Réserves

- **État partagé** : toutes les specs d'une lane sont le même joueur. Règle : chaque spec crée
  son héros avec un nom unique (`e2e-${Date.now()}`) et ne vérifie que lui, jamais un compte
  global (« 1 héros »).
- Ça tient parce qu'il n'y a **1 worker par runner** : les specs d'une lane passent l'une
  après l'autre. À 2 workers, deux Cypress partageraient le joueur, et il faudrait passer au
  plugin cookie ([piste-identite-par-test.md](piste-identite-par-test.md)).
- L'overlay ne doit **jamais** être monté hors E2E : il fait de tout appelant `e2e-player`. On
  ne le monte que dans `compose.e2e.yaml`.

## Sources

- `player-backend/Player.Presentation/Authentication/CurrentPlayerResolver.cs`
- `player-backend/Player.Presentation/Hubs/PlayerHub.cs`
- `dungeon-backend/Dungeon.Presentation/Hubs/DungeonHub.cs` (identité seulement loguée, pas
  exigée)
- `frontend-game/app/shared/api/signalRHubClient.ts` (WebSocket seul, négociation sans header
  d'identité)
