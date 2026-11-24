[← README](README.md)

# Pistes d'identité non retenues

**Statut : non retenues (2026-11-24).** On utilise le vrai Keycloak avec un utilisateur par
test, voir [identite.md](identite.md).

## Identité fixe posée par Traefik

C'était le premier choix, quand le front n'avait pas encore Keycloak. Un overlay
`deploy/traefik/e2e/` forçait `X-User-Id: e2e-player` sur toutes les routes.

**Verdict** : dépassé depuis l'arrivée de Keycloak sur `dev`. Ce choix contournait l'auth au
lieu de la tester, et toutes les specs d'une lane partageaient le même joueur.

## Header par test via `cy.intercept`

**Verdict** : ça casse `PlayerHub`, parce que l'upgrade WebSocket ne passe pas par
l'intercept. De toute façon, Traefik écrase maintenant `X-User-Id` depuis le JWT.

## Plugin Traefik cookie → header

Un plugin local yaegi copiait un cookie dans `X-User-Id`.

**Verdict** : inutile, le plugin JWT lit déjà `access_token` en query pour le WS.

## Login UI via `cy.origin`

Cypress remplissait la vraie page de login Keycloak (`localhost:8081`), avec `cy.session` pour
le cache.

**Verdict** : plus lent et dépendant du thème `lantern`. On teste l'intégration avec le gateway,
pas le formulaire Keycloak.

**À revoir si** un parcours « inscription » ou « connexion » doit lui-même être couvert en E2E.
