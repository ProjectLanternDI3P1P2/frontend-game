# F00 - Fondation du classement par héros (contrat, clients, données simulées, règles)

## Cadre

Sensible : oui (contrat d'API externe provisoire, code partagé par F02, F03 et F04)
Revue : approfondie
Dépend de : Aucune
Taille estimée : ~800 lignes (dont données simulées et tests)
Fichier d'acceptation : `app/features/leaderboard/tests/F00AcceptanceTest.spec.ts`

## Objectif

Le Figma présente un classement **par héros**, avec filtres, pagination, tendance, détail et faits. Le contrat F01 (par joueur, top 50) ne suffit plus. F00 pose le nouveau contrat provisoire, les clients réel et simulé, des données simulées réalistes et les règles pures. F02, F03 et F04 pourront ainsi partir en parallèle sans se marcher dessus.

## Critères d'acceptation

- [ ] CA1 : `types.ts` contient exactement le contrat partagé ci-dessous. Les types de statistiques de F01 restent inchangés.
- [ ] CA2 : le client Gateway appelle les routes du contrat, avec les segments encodés et les paramètres de requête attendus (`class` omis quand il vaut `null`, `search` omis quand il est vide).
- [ ] CA3 : le client simulé applique le filtre de classe, la période, la recherche (insensible à la casse, sur le joueur et le héros), le tri et la pagination. `totalCount` et `me` reflètent les filtres.
- [ ] CA4 : les scénarios `?mock=played|empty|lagging|rebuilding|frozen|error|consolidating` produisent les réponses décrites. Le défaut est `played`. Une valeur inconnue revient au défaut.
- [ ] CA5 : les données simulées contiennent le joueur courant avec 3 héros (rangs 7, 58 et 210, le Mage étant absent de la saison), au moins 2 joueurs supprimés, des `rankDelta` `null` et non nuls, et des lignes `isPending`.
- [ ] CA6 : chaque règle pure de `leaderboardRules.ts` listée dans le contrat est testée, y compris `parseRankingQuery` avec des valeurs invalides.
- [ ] CA7 : `RankingRowDetail.vue` existe en bouchon avec les props du contrat.
- [ ] CA8 : `/leaderboard` continue de fonctionner sur le nouveau contrat, avec une adaptation minimale :
  - la page affiche la première page du classement, dont les colonnes Rank, Hero et Total XP ;
  - les tests F01 du classement (CA7 à CA11) sont adaptés ou retirés s'ils deviennent obsolètes.
    La page des statistiques du héros reste intacte : les tests F01 CA1 à CA6 passent sans modification.
- [ ] CA9 : `npm run lint`, `npm run typecheck` et `npm run test:unit` passent.

## Périmètre

Fichiers possédés :

- `app/features/leaderboard/types.ts`
- `app/features/leaderboard/api/**`
- `app/features/leaderboard/mocks/**`
- `app/features/leaderboard/leaderboardRules.ts`
- `app/features/leaderboard/composables/useLeaderboard.ts` (renommage possible en `useRanking.ts`)
- `app/features/leaderboard/components/RankingRowDetail.vue` (bouchon)
- adaptation minimale de `components/LeaderboardView.vue`, `components/LeaderboardTable.vue` et `app/pages/leaderboard.vue`
- `app/features/leaderboard/tests/**` (tests de l'API, des règles, de la source et du composable ; fixtures ; adaptation de `F01AcceptanceTest.spec.ts` et `LeaderboardPages.spec.ts`, `LeaderboardTable.spec.ts`)
- `app/features/leaderboard/README.md`

Fichiers en lecture seule : `app/shared/**`, `app/features/player/**`, statistiques du héros (`statisticsRules.ts`, `statisticsCatalogue.ts`, `useHeroStatistics.ts`, `HeroStatistics*.vue`, `ConsolidationStatus.vue`).
Hors périmètre : toute nouvelle interface du classement (F02), le détail et les faits (F03), la page publique (F04), `nuxt.config.ts`.

## Contrats partagés

Fournis : tout le contrat ci-dessous → utilisé par F02, F03 et F04.
Utilisés : Aucun.

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
