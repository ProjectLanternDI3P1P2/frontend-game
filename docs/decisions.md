# Décisions du projet

> Historique à lire : ADR existants dans `docs/adr/` (ADR-FE-001 à ADR-FE-015), ainsi que `docs/GIT_RULES.md`.

<!-- Le plus récent en haut. Format : voir le skill decision-log. -->

## D25 - 2026-11-27 - F05 : logique du boss dans des fichiers neufs, diff minimal dans l'explorateur

Décision : l'invariant du boss vit dans `bossRules.ts`, `useFloorBoss.ts` et `DungeonBossNotice.vue` (nouveaux) ; `useDungeonExplorer.ts` et `[runId].vue` ne reçoivent que des lignes de branchement, sans refactoring.
Pourquoi : `feature/combat-collision-frontend` (non mergée) modifie fortement ces deux fichiers ; un diff minimal garde les conflits triviaux et réduit le couplage.
Écarté : attendre le merge de cette branche (dépendance de calendrier) ; partir de cette branche (travail bâti sur du code non validé).
Source : discussion

## D24 - 2026-11-27 - US #266 : périmètre front resserré sur les tâches #1084 à #1088

Décision : remplace D23. La fiche F05 couvre l'invariant du boss, l'état explicite quand il est rompu, le retry du chargement de l'étage, la synchronisation avec le serveur et les tests reliés aux CA de l'US. La télémétrie (modification de l'endpoint partagé) et le retry du combat sortent du périmètre ; l'E2E (#1089) fera l'objet d'une fiche F06 après F05.
Pourquoi : travail en équipe : s'en tenir à l'US et ne pas modifier le code partagé ni le périmètre de la squad Combat. Les types et l'affichage du boss existaient déjà (`f016c6c`, `2872f31`).
Écarté : télémétrie `dungeon.contract` (touche `server/api/telemetry.post.ts`, partagé : à proposer à l'équipe) ; E2E dans F05 (risque d'auth Keycloak, ne doit pas bloquer F05).
Source : discussion

## D23 - 2026-11-26 - US-DONGEON-07 (boss final) : approche « garde-fous + états dégradés »

Décision : côté front, l'US #266 ajoute une règle pure qui vérifie l'invariant du boss (exactement un élément `boss`, dans la salle de type `boss`), des états explicites quand le contrat est rompu, un retry et un anti double clic sur le combat contre le boss, un événement de télémétrie en cas de rupture du contrat, et des tests d'acceptation reliés aux CA 1 à 4.
Pourquoi : l'affichage nominal du boss existe déjà sur `dev` ; la valeur de l'US côté front est la preuve, la robustesse et la mesure.
Écarté : tests seuls (n'apportent aucune robustesse) ; E2E Cypress du donjon dans cette fiche (coût et risque d'auth Keycloak en E2E ; possible dans une fiche ultérieure).
Source : discussion

## D22 - 2026-11-26 - Combat contre le boss hors périmètre de l'US #266

Décision : on garde le bouchon actuel `defeatFloorBoss` pour le combat contre le boss ; l'US #266 n'y ajoute que le retry et la protection contre la double soumission. L'écran de combat reste à la squad Combat (`feature/combat-screen`, non mergée).
Pourquoi : la squad Dungeon définit l'emplacement, la squad Combat définit le boss et son comportement (ADR-FE-009).
Écarté : intégrer `feature/combat-screen` dans cette US (feature d'une autre squad, non mergée).
Source : discussion

## D21 - 2026-11-26 - Le front ne code pas le numéro de la salle du boss

Décision : le front repère le boss final par la salle de type `boss` et l'élément de type `boss` renvoyés par le back, jamais par un numéro de salle (« salle 40 ») codé en dur.
Pourquoi : la position du boss est une règle de génération du back (déterminée par la seed) ; la coder côté front couplerait les deux dépôts.
Écarté : vérifier `id === 40` ou `rooms.length === 40` côté front (casserait les fixtures à 10 salles et dupliquerait une règle back).
Source : discussion

## D20 - 2026-10-21 - « Previous season final board » ouvre le classement All time

Décision : faute de paramètre de saison dans le contrat, l'action de l'état vide bascule la période sur All time. Elle est désactivée, avec une explication, si la période est déjà All time. À corriger quand le back exposera la saison (`seasonId` dans `RankingQuery`).
Pourquoi : le contrat F00 ne permet pas de lire une saison passée.
Écarté : étendre le contrat en cours de lot (le contrat est figé après lancement).
Source : rapport F02

## D19 - 2026-10-21 - Ma ligne : `aria-current` unique, séparateur en tri XP seulement

Décision : badge « You » et surlignage sur tous mes héros ; `aria-current="true"` sur une seule ligne (celle visée par « Jump to my rank », sinon mon meilleur héros). Le séparateur « N positions between… » n'apparaît qu'en tri Total XP. « Jump to my rank » remet le tri sur Total XP et garde les autres filtres.
Pourquoi : RGAA (un seul élément courant) ; avec un autre tri, les rangs de la page ne sont pas contigus.
Écarté : `aria-current` sur toutes mes lignes (CA6 de la fiche, contredit par D9 et les notes F00).
Source : rapport F02

## D18 - 2026-10-21 - Exception `useAsyncData` pour la page publique

Décision : le test F01 « CA2: the feature keeps no client cache » exclut uniquement `composables/usePublicRanking.ts`, qui utilise `useAsyncData` (hydratation SSR, pas de cache client).
Pourquoi : D11 impose le SSR à `/rankings` ; la règle « pas de cache client » (D3) reste vraie pour les pages personnelles.
Écarté : retirer le test CA2 (garde-fou utile).
Source : rapport F04

## D17 - 2026-10-21 - `/rankings` : erreurs et fraîcheur sous cache `swr`

Décision : en cas d'erreur, le serveur répond 503 avec un message générique fixe, et la date de fraîcheur est absolue en UTC. Les médailles et la tendance reprennent des tokens existants et portent l'information par le texte.
Pourquoi : Nitro ne met en cache que les réponses en dessous de 400 (une panne ne doit pas écraser la bonne page) ; la page indexable ne doit pas exposer de texte interne ; une date relative casserait l'hydratation.
Écarté : répondre 200 avec un état d'erreur.
Source : rapport F04

## D16 - 2026-10-21 - Tiroir des faits : piège à focus local

Décision : `RankingFactsDrawer.vue` implémente lui-même le piège à focus et le retour du focus au bouton d'ouverture. Le détail utilise `h3` (« Hero · <name> ») et `h4` (« Last 4 runs »), ce qui suppose un `h2` de F02 au-dessus.
Pourquoi : `UiModal` (`app/shared`, en lecture seule pour ce lot) gère Échap mais pas le focus.
Écarté : modifier `UiModal` (zone partagée, à proposer dans une fiche dédiée).
Source : rapport F03

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
