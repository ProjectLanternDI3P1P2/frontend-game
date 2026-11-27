# Décisions du projet

> Historique à lire : ADR existants dans `docs/adr/` (ADR-FE-001 à ADR-FE-015), ainsi que `docs/GIT_RULES.md`.

<!-- Le plus récent en haut. Format : voir le skill decision-log. -->

## D25 - 2026-11-26 - Plus de `nitro.errorHandler` : logs JSON dans un plugin Nitro

Décision : `server/error-handler.ts` est supprimé ; le log JSON des échecs serveur passe dans `server/plugins/error-log.ts` (hook `error`, mêmes conditions : non gérée, fatale ou ≥ 500). Nuxt rend ainsi `app/error.vue` en SSR.
Pourquoi : Nuxt n'installe son handler (celui qui rend `error.vue`) que si `nitro.errorHandler` n'est pas défini ; sinon une 404 SSR renvoyait un corps JSON (CA3 de US-PLAYER-06).
Écarté : recopier la logique interne de Nuxt (`/__nuxt_error`, non exportée) ; accepter une 404 JSON au premier chargement. Coût accepté : ligne texte `[request error]` de Nitro en plus pour les erreurs non gérées ou fatales.
Source : US-PLAYER-06, validé par l'utilisateur

## D24 - 2026-11-26 - `app/error.vue` global

Décision : 404 avec `statusText` « Player not found » → « Player not found » ; toute autre 404 → « Page not found » ; sinon message générique. Toujours `noindex` ; retour par `clearError({ redirect: "/rankings" })`.
Pourquoi : la page d'erreur sert toute l'app ; `/` et `/home` renvoient un visiteur anonyme vers la connexion, `/rankings` est la page publique la plus proche.
Écarté : un libellé « Player not found » pour toute 404.
Source : US-PLAYER-06

## D23 - 2026-11-26 - Profil public : 404 sans appel pour une ref hors format, champs filtrés

Décision : `/profiles/:ref` → GUID = appel par id ; `[a-z0-9-]{1,32}` (après passage en minuscules) = appel par handle ; autre chose = 404 sans appel. Le profil reçu est réduit aux champs du contrat (`toPublicProfile`) avant d'entrer dans l'état `useAsyncData`. La 404 est levée avec `fatal: import.meta.client` (le serveur rend l'erreur sans `fatal` et ne la journalise pas en « fatal ») ; une autre erreur répond 503 avec un message fixe et Retry, comme `/rankings` (D17).
Pourquoi : le router anonyme de Traefik ne laisse passer que ces deux formats (sinon 401 traité comme une panne) ; l'état part dans le HTML public, un champ en trop (e-mail) ne doit jamais y arriver.
Écarté : `fatal: true` partout ; recopier tel quel l'objet de l'API.
Source : US-PLAYER-06

## D22 - 2026-11-26 - Route publique `/profiles/:ref` en SSR `swr: 60`

Décision : `app/pages/profiles/[ref].vue`, `"/profiles/**": { ssr: true, prerender: false, swr: 60 }`, canonical sur la forme par handle (`siteUrl` + `/profiles/{handle}`, sans `app.baseURL` car `siteUrl` contient déjà `/game` en prod). Pas de lien depuis l'accueil : il est authentifié (CSR) et aucun endpoint ne liste les joueurs.
Pourquoi : `/players/**` est l'espace authentifié en CSR ; une ressource publique au pluriel suit le modèle de `/rankings` ; `swr: 60` s'aligne sur le `max-age=60` de l'API.
Écarté : `/players/:id/profile` (mélange public et authentifié).
Source : US-PLAYER-06, validé par l'utilisateur

## D21 - 2026-11-26 - Appel anonyme par `token: null`, router Traefik dédié

Décision : `getPublicProfileById` / `getPublicProfileByHandle` passent `token: null` au `GatewayClient` (aucun `Authorization`, seulement `Accept` et `X-Correlation-Id`). Traefik : router `player-public-profile-api` (priorité 200, `remove-external-identity` sans `keycloak-jwt`) limité à GET/HEAD/OPTIONS sur les deux routes, GUID strict et handle `[A-Za-z0-9-]{1,32}`.
Pourquoi : pas besoin d'un second client ; `player-api` exige un JWT sur tout `/api/player/` ; OPTIONS est nécessaire au préflight CORS (en-tête `X-Correlation-Id`) et HEAD aux sondes.
Écarté : nouveau client anonyme ; exception sur `/api/player/v1/players/**` (trop large) ; GET seul (casse le préflight).
Source : US-PLAYER-06, revue n°1

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
