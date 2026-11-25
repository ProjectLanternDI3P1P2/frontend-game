# F01 - Statistiques cumulées du héros et classement (leaderboard, données simulées)

## Cadre
Sensible : oui (config `nuxt.config.ts`, layout partagé, contrat d'API externe provisoire)
Revue : approfondie
Dépend de : Aucune
Taille estimée : ~900 lignes de diff (tests et données simulées compris)
Fichier d'acceptation : `app/features/leaderboard/tests/F01AcceptanceTest.spec.ts`

## Objectif
Le joueur doit pouvoir consulter les valeurs cumulées de chaque statistique du catalogue pour son héros, et voir le classement des 50 meilleurs joueurs avec sa propre position. Le back leaderboard (consolidation toutes les ~5 min) n'est pas encore disponible : le front livre le visuel complet sur des données simulées, derrière une interface qui permettra de brancher le vrai back sans toucher aux composants.

## Critères d'acceptation
Statistiques du héros — page `/players/[playerId]/heroes/[heroId]/statistics`
- [ ] CA1 : pour un héros ayant joué, chaque statistique du catalogue est affichée avec son libellé et sa valeur cumulée, groupée par catégorie.
- [ ] CA2 : les données sont relues à chaque ouverture de la page (aucun cache client) et la date de dernière consolidation est affichée (ex. « Mis à jour il y a 3 min »).
- [ ] CA3 : héros sans partie (réponse vide ou clés manquantes) : chaque statistique du catalogue affiche 0 ; aucun message d'erreur, aucun écran vide.
- [ ] CA4 : réponse signalant une consolidation en cours : la dernière version consolidée est affichée normalement, avec au plus une mention discrète (non bloquante, pas un état d'erreur).
- [ ] CA5 : échec de l'appel : message d'erreur explicite (`role="alert"`) et bouton « Réessayer » qui relance le chargement ; l'état de chargement est annoncé (`aria-live="polite"`).
- [ ] CA6 : le lien « View progression → » de la fiche héros mène à cette page pour ce héros.

Classement — page `/leaderboard`
- [ ] CA7 : au plus 50 joueurs affichés, triés par rang croissant, dans un `<table>` sémantique (rang, joueur, score), avec la date de consolidation et un bouton « Actualiser ».
- [ ] CA8 : joueur courant dans le top 50 : sa ligne porte un badge « Vous » et `aria-current="true"` (pas seulement une couleur) ; le bouton « Voir ma position » fait défiler jusqu'à sa ligne et lui donne le focus.
- [ ] CA9 : joueur courant hors du top 50 : sa ligne est épinglée sous le tableau avec son rang réel et son score.
- [ ] CA10 : classement vide : message explicite, pas d'erreur. Échec de l'appel : même comportement que CA5.
- [ ] CA11 : un lien « Leaderboard » est présent dans la navigation principale.

Transverse
- [ ] CA12 : la source des données (simulée ou réelle) se choisit en un seul endroit ; en mode simulé, `?mock=played|empty|consolidating|error` sélectionne le scénario (défaut `played`), avec un délai simulé court (~300 ms). Aucun composant n'importe les données simulées directement.
- [ ] CA13 : accessibilité RGAA : un seul `h1` par page, listes avec `role="list"`, focus visible, information jamais portée par la seule couleur ; `npm run lint`, `npm run typecheck` et `npm run test:unit` passent.

## Périmètre
Fichiers possédés :
- `app/features/leaderboard/**` (nouvelle feature, à partir de `app/features/_template` : `types.ts`, `api/`, `mocks/`, `components/`, `composables/`, règles pures `*Rules.ts`, `tests/`, `README.md`)
- `app/pages/leaderboard.vue` (ou `app/pages/leaderboard/index.vue`)
- `app/pages/players/[playerId]/heroes/[heroId]/statistics.vue`
- `app/pages/players/[playerId]/heroes/[heroId]/index.vue` : uniquement le `href` du lien « View progression → » (ligne ~265)
- `app/layouts/default.vue` : uniquement l'ajout de l'entrée « Leaderboard » dans `navigationItems`
- `nuxt.config.ts` : uniquement les deux entrées `routeRules` en `ssr: false`
- `docs/rendering-modes.md` : justification de ces deux routes
- `cypress/e2e/F01AcceptanceTest.cy.ts` (facultatif, avec `cy.intercept`/mode simulé et `cy.checkA11y()`)

Fichiers en lecture seule : `app/shared/**` (réutiliser `UiStat`, `UiNotice`, `UiButton`, `createGatewayClient`, `GatewayError`, `useGateway`), `app/features/player/**` (dont `seededPlayer.ts`).
Hors périmètre : back et vrai contrat ; classement entre héros ou par saison ; pagination au-delà de 50 ; temps réel (SignalR) ; authentification ; modification de `app/shared/**`.

## Contrats partagés
Fournis : Aucun (contrat provisoire interne, ci-dessous)
Utilisés : `GatewayClient` / `GatewayError` (`app/shared/utils/gateway.ts`), `SEEDED_PLAYER_ID`, `UiStat`.

Contrat provisoire (à isoler dans `types.ts` + `api/`, susceptible de changer) :
```ts
// GET progression/players/{playerId}/heroes/{heroId}/statistics
interface HeroStatisticsResponse {
  heroId: string;
  consolidatedAt: string | null;   // ISO 8601, null si jamais consolidé
  isConsolidating: boolean;
  statistics: { key: string; value: number }[]; // clés absentes = 0
}
// GET progression/leaderboard?limit=50&playerId={playerId}
interface LeaderboardResponse {
  consolidatedAt: string | null;
  entries: { rank: number; playerId: string; playerName: string; score: number }[];
  me: { rank: number; playerId: string; playerName: string; score: number } | null;
}
```
Le catalogue des statistiques (clé, libellé, catégorie) est une constante front provisoire dans la feature, environ 15 clés réparties en Parties, Donjon, Combat, Récompenses (s'inspirer des événements de `deploy/rabbitmq/definitions.json` : parties jouées, donjons terminés, salles explorées, coffres ouverts, combats gagnés, actions, récompenses obtenues, objets consommés, achats…).

## Contexte utile
- Décisions : D1 (contrat provisoire + simulé), D2 (CSR, cartes `UiStat` / `<table>`), D3 (pas de cache, relecture, normalisation en fonctions pures), D4 (top 50 + `me`), D5 (joueur courant = `SEEDED_PLAYER_ID`) dans `docs/decisions.md`.
- Modèle à suivre : `app/features/player/api/playerApi.ts` (`createXxxApi(client)` sans dépendance framework + `useXxxApi()`, `encodeURIComponent` sur les segments) et ses tests à stub `vi.fn()` ; gestion d'états de `PlayerHomeView.vue`.
- `buildGatewayUrl` : tout chemin autre que `player/...` devient `/api/v1/<path>` ; `progression/...` est routé vers le service `leaderboard` par Traefik. Ne pas modifier `gateway.ts`.
- `nuxt.config.ts` indique « CSR is never the default » : chaque route CSR doit être déclarée et justifiée dans `docs/rendering-modes.md`.
- Styles : SCSS + BEM, tokens `--color-*` uniquement, `@include bp.from('md')`, tableau lisible sur mobile.
- Libellés d'interface en anglais, comme le reste de l'app (« View progression », « Retry »…), sauf les exemples de cette fiche, à traduire.
- Pas de nouvelle dépendance npm.

## Questions ouvertes
Aucune.
