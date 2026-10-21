# Décisions du projet

> Historique à lire : ADR existants dans `docs/adr/` (ADR-FE-001 à ADR-FE-015), ainsi que `docs/GIT_RULES.md`.

<!-- Le plus récent en haut. Format : voir le skill decision-log. -->

## D15 - 2026-10-21 - Synchronisation URL du classement

Décision : clés d'URL `class`, `period`, `search`, `sort`, `page` ; `parseRankingQuery` est tolérante (casse, espaces, valeurs invalides ramenées au défaut, recherche limitée à 64 caractères, `mock` ignoré) ; `toRouteQuery` n'écrit que les valeurs différentes du défaut ; taille de page fixe à 10.
Pourquoi : liens partageables propres et robustes.
Écarté : Aucun
Source : rapport F00

## D14 - 2026-10-21 - Sens du rang et population simulée

Décision : le rang est la position par XP sur la période choisie, toutes classes confondues ; filtre de classe, recherche et tri ne renumérotent pas ; `totalXp` est l'XP de la période. Les données simulées comptent 220 héros « depuis toujours », dont 120 dans la saison (en saison, mon Warrior est 2e et mon Shaman 7e).
Pourquoi : un rang stable quel que soit le filtre ; le Mage peut être 210e tout en étant absent de la saison.
Écarté : renuméroter selon les filtres (rang trompeur).
Source : rapport F00

## D13 - 2026-10-21 - Lot leaderboard : périmètre strict et découpage

Décision : uniquement les pages leaderboard (`/leaderboard`, `/rankings`), aucune autre page modifiée. Le lot est découpé en F00 (contrat, clients, mocks, règles) puis F02 (page classement), F03 (détail et faits) et F04 (page publique) en parallèle, sur la base `feature/leaderboard-hero-statistics`.
Pourquoi : demande explicite de l'utilisateur ; le contrat partagé doit être figé avant le parallélisme.
Écarté : une seule fiche (plus de 2 500 lignes, non parallélisable).
Source : discussion

## D12 - 2026-10-21 - Profil public et reconstruction

Décision : « View public profile » mène à `/players/{playerId}/heroes` et disparaît pour un joueur supprimé. « Rebuild from facts » est visible mais désactivé (« Operators only »).
Pourquoi : l'écran de profil public (Figma 99) est hors lot ; il n'y a ni authentification ni rôle opérateur.
Écarté : créer une page de profil (hors périmètre leaderboard).
Source : discussion

## D11 - 2026-10-21 - Page publique `/rankings` en SSR `swr: 60`

Décision : vitrine publique et indexable séparée (podium, leaders par classe, top 10), reliée par des liens à `/leaderboard`, qui reste en CSR.
Pourquoi : le Figma 98 la veut « SSR, indexable » ; les données sont non personnelles et peuvent avoir une minute de retard.
Écarté : un lien depuis l'accueil (hors pages leaderboard).
Source : discussion

## D10 - 2026-10-21 - Onglets du classement

Décision : « Ranking » actif. « My progression » mène à la page des statistiques (F01) de mon héros le mieux classé. « Run history » est désactivé avec « Coming soon ».
Pourquoi : aucun écran Figma pour ces deux onglets ; on reste dans le périmètre leaderboard.
Écarté : créer ces écrans.
Source : discussion

## D9 - 2026-10-21 - Style : celui du projet, Figma pour le contenu

Décision : les primitives `Ui*`, les tokens `--color-*` et le BEM existants sont réutilisés. Le Figma fait foi pour le contenu, les libellés et le comportement, pas pour le visuel. L'or de ma ligne est doublé du badge texte « You » (RGAA).
Pourquoi : demande de l'utilisateur ; cohérence avec le reste de l'app.
Écarté : reproduire le visuel du Figma.
Source : discussion

## D8 - 2026-10-21 - Classement par héros (remplace la partie classement de D4)

Décision : une ligne par héros, trié par XP totale. Filtres de classe et de période, recherche, tri, pagination par 10, tendance, statuts LIVE / LAGGING / REBUILDING / FROZEN. `me` devient la liste de mes héros. Un clic sur une ligne la déplie sur place, sans ouvrir de profil. Contrat provisoire dans la fiche F00.
Pourquoi : c'est ce que montre le Figma (« one row per hero », « opens the row, not a profile »).
Écarté : le top 50 par joueur de D4.
Source : discussion (comparaison Figma)

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
