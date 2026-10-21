# Décisions du projet

> Historique à lire : ADR existants dans `docs/adr/` (ADR-FE-001 à ADR-FE-015), ainsi que `docs/GIT_RULES.md`.

<!-- Le plus récent en haut. Format : voir le skill decision-log. -->

## D7 - 2026-10-21 - Données leaderboard : robustesse d'affichage

Décision : une erreur sans message affiche un message générique ; une date de consolidation invalide affiche « Not consolidated yet » au lieu de faire planter la page ; l'API leaderboard est injectable via `provide(LEADERBOARD_API_KEY)` pour tester les vues sans Nuxt.
Pourquoi : CA3/CA4 (jamais d'écran vide ni d'erreur) face à un contrat provisoire.
Écarté : Aucun
Source : rapport F01

## D6 - 2026-10-21 - routeRules des statistiques en motif `*`

Décision : la route CSR des statistiques est déclarée `"/players/*/heroes/*/statistics"` ; le `h1` est « Hero statistics », sans le nom du héros.
Pourquoi : le matcher de Nitro (radix3) ne reconnaît pas `**` au milieu d'un chemin ; afficher le nom imposerait un second appel à l'API player.
Écarté : `/players/**/statistics` (ne correspond pas).
Source : rapport F01

## D5 - 2026-10-21 - Joueur courant = joueur de démo

Décision : tant que Keycloak n'est pas intégré, « moi » (stats, position au classement) est `SEEDED_PLAYER_ID` (`app/features/player/seededPlayer.ts`).
Pourquoi : pas d'authentification dans `dev`, convention déjà utilisée dans toute l'app.
Écarté : sélecteur de joueur (inutile pour la démo).
Source : discussion

## D4 - 2026-10-21 - Classement : top 50 + position du joueur en une réponse

Décision : une réponse `{ consolidatedAt, entries (≤ 50), me }` ; ma ligne mise en évidence sans dépendre de la couleur (badge « Vous » + `aria-current`), bouton « Voir ma position » ; hors top 50, ma ligne est épinglée sous le tableau avec mon rang réel.
Pourquoi : un seul appel, comportement identique dans ou hors du top 50.
Écarté : appel séparé pour la position (deux états de chargement) ; pagination (non demandée).
Source : discussion

## D3 - 2026-10-21 - Données leaderboard : pas de cache, relecture à chaque visite

Décision : composable par page (chargement, données, vide, erreur + Réessayer), relecture à chaque ouverture, bouton « Actualiser » sur le classement, date de consolidation affichée ; normalisation (stats manquantes = 0, tri, repérage de ma ligne) dans des fonctions pures testées.
Pourquoi : ADR-FE-008 (le back est la source de vérité) ; la consolidation (~5 min) est faite par le back.
Écarté : store/cache client ; temps réel SignalR (prématuré tant que le back consolide par lots).
Source : discussion

## D2 - 2026-10-21 - Pages leaderboard en CSR

Décision : `/leaderboard` et `/players/**/heroes/**/statistics` en `ssr: false` dans `routeRules`, justifiés dans `docs/rendering-modes.md`. Stats en cartes `UiStat` groupées par catégorie ; classement en `<table>` sémantique.
Pourquoi : données personnelles et changeantes, aucun intérêt SEO, auth Keycloak à venir côté client.
Écarté : SSR + `swr` (n'aurait de sens que pour un classement public sans « ma position »).
Source : discussion

## D1 - 2026-10-21 - Leaderboard sur contrat provisoire et données simulées

Décision : feature `app/features/leaderboard/` ; client écrit sur un contrat provisoire (types à la main), avec une implémentation simulée (fichiers dans `mocks/`, scénarios `?mock=played|empty|consolidating|error`) choisie en un seul endroit ; composants indépendants de la source.
Pourquoi : le back leaderboard n'a pas publié son contrat ; besoin d'un visuel pour le client.
Écarté : route serveur Nuxt simulée (code serveur à jeter) ; données en dur dans les pages (tout à refaire).
Source : discussion
