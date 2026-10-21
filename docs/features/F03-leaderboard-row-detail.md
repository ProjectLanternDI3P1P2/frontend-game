# F03 - Détail d'une ligne du classement et tiroir des faits

## Cadre

Sensible : non (interface seule, contrat figé par F00)
Revue : standard
Dépend de : F00 (intégrée)
Taille estimée : ~600 lignes (dont tests)
Fichier d'acceptation : `app/features/leaderboard/tests/F03AcceptanceTest.spec.ts`

## Objectif

Quand on déplie une ligne du classement, le joueur voit le détail du héros (Figma 82) et peut ouvrir la provenance de son score, « Facts behind this row » (Figma 83), dans le style UI du projet.

## Critères d'acceptation

- [ ] CA1 : `RankingRowDetail.vue` (mêmes props que le contrat) charge `getRankingHeroDetail(heroId)` et affiche :
  - « Hero · <name> » ;
  - la classe, le niveau, le palier NG+ et la date de création ;
  - une barre de progression (`UiProgressBar`) « <xpIntoLevel> / <xpForNextLevel> XP », avec le pourcentage en texte.
- [ ] CA2 : section « Last 4 runs » avec, pour chaque partie, l'issue (Victory / Defeat / Abandoned, en texte et pas seulement en couleur), la salle « x / max », le boss, l'XP gagnée et la date relative. S'il n'y a aucune partie, le message est « No run yet ».
- [ ] CA3 : « Bosses defeated » et « Deepest room » affichés en `UiStat`.
- [ ] CA4 : le lien « View public profile » mène à `/players/{playerId}/heroes`. Il est absent si `playerId` est `null` (joueur supprimé).
- [ ] CA5 : le bouton « Facts behind this row » ouvre un tiroir ou une modale (`UiModal`) qui charge `getRankingHeroFacts(heroId)` et affiche :
  - la liste des faits (type, identifiant, date de réception, statut Applied / Pending / Rejected en texte, XP, motif) ;
  - « XP from facts » et la clé d'idempotence ;
  - le bouton « Rebuild from facts » désactivé, avec la mention « Operators only ».
    Le focus est piégé dans le tiroir, Échap le ferme, et le focus revient sur le bouton d'ouverture.
- [ ] CA6 : chaque chargement (détail, faits) a ses propres états : chargement annoncé, erreur `role="alert"` avec « Retry ». Une erreur du détail n'affecte pas le reste du classement.
- [ ] CA7 : accessibilité RGAA (voir Contexte) ; `npm run lint`, `npm run typecheck` et `npm run test:unit` passent.

## Périmètre

Fichiers possédés :

- `app/features/leaderboard/components/RankingRowDetail.vue` (remplace le bouchon F00)
- `app/features/leaderboard/components/RankingFacts*.vue`
- `app/features/leaderboard/components/RankingHero*.vue`
- `app/features/leaderboard/composables/useRankingHeroDetail.ts`
- `app/features/leaderboard/composables/useRankingHeroFacts.ts`
- `app/features/leaderboard/rankingDetailRules.ts` (si besoin)
- tests : `F03AcceptanceTest.spec.ts`, `RankingRowDetail*.spec.ts`, `RankingFacts*.spec.ts`, `useRankingHero*.spec.ts`

Fichiers en lecture seule : `types.ts`, `api/**`, `mocks/**`, `leaderboardRules.ts`, `app/shared/**`, tous les autres composants du classement (F02).
Hors périmètre : la ligne et le tableau eux-mêmes (F02) ; l'action réelle de reconstruction.

## Contrats partagés

Fournis : `RankingRowDetail.vue`, avec les props `{ heroId: string; currentPlayerId: string }` et aucun emit → affiché par F02.
Utilisés : contrat F00 ← F00.

### Contrat de données provisoire (fourni par F00, identique dans F00, F02, F03, F04)

Dans `app/features/leaderboard/types.ts`. Les types `HeroStatistics*` de F01 restent inchangés. Les anciens `LeaderboardEntry`, `LeaderboardResponse` et `getLeaderboard` sont remplacés.

```ts
export enum HeroClass {
  WARRIOR = "warrior",
  SHAMAN = "shaman",
  MAGE = "mage",
}
export enum RankingPeriod {
  ALL_TIME = "all-time",
  SEASON = "season",
  WEEK = "week",
}
export enum RankingSort {
  TOTAL_XP = "total-xp",
  LEVEL = "level",
  WIN_RATE = "win-rate",
  LAST_ACTIVITY = "last-activity",
}
export enum RankingStatus {
  LIVE = "live",
  LAGGING = "lagging",
  REBUILDING = "rebuilding",
  FROZEN = "frozen",
}
export enum RunOutcome {
  VICTORY = "victory",
  DEFEAT = "defeat",
  ABANDONED = "abandoned",
}
export enum FactStatus {
  APPLIED = "applied",
  PENDING = "pending",
  REJECTED = "rejected",
}

export interface RankingQuery {
  playerId: string; // joueur courant (D5)
  heroClass: HeroClass | null; // null = toutes les classes
  period: RankingPeriod; // défaut ALL_TIME
  search: string; // "" = pas de recherche (sur playerName ou heroName, insensible à la casse)
  sort: RankingSort; // défaut TOTAL_XP ; le rang affiché reste le rang par XP totale
  page: number; // à partir de 1
  pageSize: number; // 10
}

export interface RankingEntry {
  rank: number;
  rankDelta: number | null; // null = NEW ; >0 monte, <0 descend, 0 stable
  heroId: string;
  heroName: string;
  heroClass: HeroClass;
  level: number;
  totalXp: number;
  runs: number;
  winRate: number; // 0..1
  lastActivityAt: string | null; // ISO 8601
  playerId: string | null; // null si joueur supprimé
  playerName: string | null; // null = « Anonymous hero » / « Deleted hero »
  isPending: boolean; // XP en attente de consolidation (badge « XP pending »)
}

export interface RankingStatusDetail {
  lagSeconds: number | null; // LAGGING
  pendingCount: number | null; // LAGGING
  correctUpTo: string | null; // LAGGING : classement certain jusqu'à cette date
  rebuildProgress: number | null; // REBUILDING : 0..1
  snapshotAt: string | null; // REBUILDING : instantané affiché « as of »
  frozenAt: string | null; // FROZEN
  reason: string | null; // FROZEN / LAGGING : texte libre
}

export interface RankingSeason {
  id: string;
  label: string;
  openedAt: string;
  previousSeasonId: string | null;
}

// GET progression/leaderboard/heroes?playerId&class&period&search&sort&page&pageSize
export interface RankingResponse {
  consolidatedAt: string | null;
  status: RankingStatus;
  statusDetail: RankingStatusDetail;
  season: RankingSeason;
  page: number;
  pageSize: number;
  totalCount: number; // héros classés correspondant aux filtres
  entries: RankingEntry[]; // la page demandée, triée
  me: RankingEntry[]; // tous les héros du joueur courant correspondant aux filtres (peut être vide)
}

export interface RankingRun {
  outcome: RunOutcome;
  room: number;
  maxRoom: number;
  boss: string | null;
  xp: number;
  endedAt: string;
}
// GET progression/leaderboard/heroes/{heroId}
export interface RankingHeroDetail {
  heroId: string;
  heroName: string;
  heroClass: HeroClass;
  level: number;
  ngTier: number;
  createdAt: string;
  xpIntoLevel: number;
  xpForNextLevel: number;
  lastRuns: RankingRun[]; // au plus 4, le plus récent d'abord
  bossesDefeated: number;
  deepestRoom: number;
  playerId: string | null;
}

export interface RankingFact {
  factId: string;
  type: string;
  ingestedAt: string;
  status: FactStatus;
  xp: number;
  reason: string | null;
}
// GET progression/leaderboard/heroes/{heroId}/facts
export interface RankingFactsResponse {
  heroId: string;
  xpFromFacts: number;
  idempotencyKey: string;
  facts: RankingFact[];
}

// GET progression/leaderboard/public
export interface PublicRankingResponse {
  consolidatedAt: string | null;
  season: RankingSeason;
  totalCount: number;
  podium: RankingEntry[]; // 0 à 3
  leadersByClass: { heroClass: HeroClass; entry: RankingEntry | null }[];
  top: RankingEntry[]; // 10 premiers
}

export interface LeaderboardApi {
  getHeroStatistics(
    playerId: string,
    heroId: string,
    signal?: AbortSignal,
  ): Promise<HeroStatisticsResponse>; // F01, inchangé
  getRanking(query: RankingQuery, signal?: AbortSignal): Promise<RankingResponse>;
  getRankingHeroDetail(
    heroId: string,
    signal?: AbortSignal,
  ): Promise<RankingHeroDetail>;
  getRankingHeroFacts(
    heroId: string,
    signal?: AbortSignal,
  ): Promise<RankingFactsResponse>;
  getPublicRanking(signal?: AbortSignal): Promise<PublicRankingResponse>;
}
```

### Données simulées (F00)

Un jeu déterministe d'environ 120 héros. Le client simulé applique réellement les filtres, la recherche, le tri et la pagination, pour que l'interface soit exploitable.

Le joueur courant possède 3 héros :

- un Warrior au rang 7 ;
- un Shaman au rang 58 ;
- un Mage au rang 210, absent de la saison.

Le jeu contient aussi au moins 2 héros de joueurs supprimés (`playerName: null`), des `rankDelta` variés (dont des `null`) et quelques lignes `isPending`.

`?mock=` sélectionne le scénario :

| Scénario          | Effet                                                        |
| ----------------- | ------------------------------------------------------------ |
| `played` (défaut) | Statut LIVE                                                  |
| `empty`           | `totalCount` 0, nouvelle saison avec `previousSeasonId`      |
| `lagging`         | Statut LAGGING, détails remplis, quelques lignes `isPending` |
| `rebuilding`      | Statut REBUILDING, progression à 0.62, `snapshotAt` rempli   |
| `frozen`          | Statut FROZEN                                                |
| `error`           | Toutes les méthodes échouent avec `GatewayError`             |
| `consolidating`   | Conservé pour les statistiques de F01                        |

Les autres méthodes (détail, faits, public) sont cohérentes avec le classement. Au moins un héros a des faits `rejected` et `pending`. Le délai simulé est d'environ 300 ms.

### Composants et accroches partagés

- `components/RankingRowDetail.vue` : props `{ heroId: string; currentPlayerId: string }`, aucun emit. F00 en crée un **bouchon** (simple `<p>` « Loading hero detail… »). F03 le remplace par l'implémentation réelle. F02 l'affiche dans la ligne dépliée, sans le modifier.
- `leaderboardRules.ts` (F00) expose les fonctions pures utilisées par F02, F03 et F04 :
  - `formatRankDelta(delta) → { label: "▲ 3" | "▼ 2" | "— 0" | "NEW", direction }` ;
  - `podiumMedal(rank) → "gold" | "silver" | "bronze" | null` ;
  - `positionsBetween(lastVisibleRank, myRank) → number` ;
  - `formatWinRate(0.43) → "43%"` ;
  - `formatRelativeTime(iso, now) → "12 seconds ago" | "3 min ago"…` ;
  - `displayPlayerName(entry) → string` (« Anonymous hero » si `null`) ;
  - `parseRankingQuery(routeQuery) / toRouteQuery(query)` : synchronisation avec l'URL, valeurs invalides ramenées aux valeurs par défaut ;
  - `HERO_CLASS_LABELS`, `RANKING_PERIOD_LABELS`, `RANKING_SORT_LABELS`.
- Routes : `/leaderboard` (CSR, F02) et `/rankings` (SSR `swr: 60`, F04). `/leaderboard` affiche un lien « Public rankings » vers `/rankings`, et `/rankings` un lien « Claim your place » vers `/leaderboard`.

## Contexte utile

- **Périmètre strict : pages leaderboard uniquement** (`/leaderboard`, `/rankings`). Aucune autre page ni feature n'est modifiée. La page des statistiques du héros (F01) ne change pas.
- **Style** : réutiliser le style UI déjà en place dans le projet (primitives `app/shared/ui/Ui*` : `UiTabs`, `UiSelect`, `UiInput`, `UiButton`, `UiBadge`, `UiNotice`, `UiPanel`, `UiProgressBar`, `UiModal`, `UiStat`…), les tokens `--color-*` et le BEM. Le Figma sert de référence pour le contenu, les libellés et le comportement, pas pour le visuel. Ne pas modifier `app/shared/**`.
- **Figma** : fichier `9eZ2xfw61znk5ownz34oOq`. Écrans 260:14265 (classement global), 262:14265 (filtré, non classé), 262:14711 (ligne dépliée), 262:15194 (tiroir des faits), 282:16716 (public SSR), 282:17023 (vide), 282:17283 (squelette de chargement), 282:17651 (en retard), 282:17945 (reconstruction), 282:18220 (gelé), 282:18493 (annotations). Variantes de composants : 175:15635. Les outils MCP Figma (`get_screenshot`, `get_metadata`) sont disponibles pour consulter un écran ; ne jamais copier le style Figma.
- **Décisions** : D1 à D13 dans `docs/decisions.md`, en particulier D5 (joueur courant = `SEEDED_PLAYER_ID`), D8 (classement par héros), D9 (style), D10 (onglets), D11 (`/rankings`), D12 (profil public, reconstruction).
- **Accessibilité RGAA** : un seul `h1` par page ; `<table>` avec `scope="col"` ; l'information n'est jamais portée par la seule couleur (le surlignage or de ma ligne s'accompagne du badge texte « You » ; la tendance et le podium ont un libellé texte ou `aria-label`) ; focus visible ; `prefers-reduced-motion` ; contrôles accessibles au clavier.
- **Libellés** en anglais, repris du Figma.
- **Données simulées** uniquement : aucun composant n'importe `mocks/`, tout passe par `LeaderboardApi` (D1). Aucune nouvelle dépendance npm.
- **Tests** : critères dans `app/features/leaderboard/tests/<Id>AcceptanceTest.spec.ts`. Contrôles de fin : `npm run lint`, `npm run typecheck`, `npm run test:unit`.
- **Branche de base du lot** : `feature/leaderboard-hero-statistics`. Jamais de push.

## Questions ouvertes

Aucune.
