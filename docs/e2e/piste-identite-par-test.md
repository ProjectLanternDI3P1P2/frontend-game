[← README](README.md)

# Piste : une identité par test

**Statut : non retenue (2026-11-24).** On utilise une identité fixe posée par Traefik, voir
[identite.md](identite.md).

## Header par test via `cy.intercept`

Le middleware `cy.intercept` de `cypress/support/e2e.ts` ajoute un `X-User-Id` unique par test,
et player crée le joueur à la volée.

**Verdict** : ça casse `PlayerHub`, parce que l'upgrade WebSocket ne passe pas par l'intercept.
Or le parcours de départ (lobby solo) en dépend.

## Plugin Traefik cookie → header

Un plugin local yaegi (`--experimental.localPlugins`) d'une quarantaine de lignes de Go. Il copie
un cookie `lantern-e2e-user` dans `X-User-Id`. Les cookies `localhost` sont envoyés quel que soit
le port, donc le cookie posé sur :3000 arrive sur :8088, WS compris.

**Verdict** : l'isolation est parfaite, mais c'est du Go et un flag expérimental, pour un besoin
qui n'existe pas tant qu'on reste à 1 worker par runner.

**À revoir si** on passe à 2 workers par runner, ou si l'état partagé entre specs d'une lane rend
des tests flaky.

## Keycloak dans la stack

Un vrai IdP avec forwardAuth ou validation JWT au gateway.

**Verdict** : c'est le chantier auth du projet, pas celui de l'E2E. Il faut un conteneur de plus
et un realm à provisionner, et le front n'a même pas encore de `getToken`.

**À revoir quand** le front intègre Keycloak : l'E2E devra alors passer par le vrai login, et
l'overlay d'identité disparaîtra.
