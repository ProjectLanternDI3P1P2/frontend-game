# Intégration 2026-10-21 - PRÊTE

## F00 - Fondation du classement par héros (contrat, clients, mocks, règles) : mergée
Tests : `npx vitest run app/features/leaderboard` → 13 fichiers, 268 tests verts.
Conflits : Aucun (merge `--no-ff` de `feature/f00-leaderboard-ranking-foundation`, commit c71020a ; F00 était déjà basée sur la tête F01 du lot).

## F03 - Détail d'une ligne du classement : mergée
Tests : `npx vitest run app/features/leaderboard` → 18 fichiers, 312 tests verts.
Conflits : Aucun (merge `--no-ff` de `feature/f03-leaderboard-row-detail`).

## Suite complète
`npm run lint` → OK ; `npm run typecheck` → OK ; `npm run test:unit` → 32 fichiers, 429 tests verts (2026-10-21, commit c71020a).
Après F03 : `npm run lint` → OK ; `npm run typecheck` → OK ; `npm run test:unit` → 37 fichiers, 473 tests verts (2026-10-21, merge F03).

## Tester
Verdict : OK. Aucune régression F00/F01 : sources statistiques F01 inchangées, tests F01 CA1 à CA6 identiques octet pour octet, CA7/8/10/12/13 adaptés et verts, CA9 retiré (autorisé par F00 CA8). `/leaderboard` vérifiée (top 10, badge « You », état vide, un seul h1). Test temporaire d'interactions (scénarios `?mock=`, watcher `useLeaderboard`, heroId simulé sur la page statistiques) : 18/18 verts, supprimé ensuite.
Problème mineur connu : `app/features/leaderboard/tests/F01AcceptanceTest.spec.ts` n'est pas au format Prettier (défaut antérieur à F00) ; le prochain commit qui le touchera sera reformaté par lint-staged.

Tester F03 (lancé car F00 déjà intégrée) — Verdict : OK. Aucune régression F00/F01/F03, contrat F00 respecté (clients, `?mock=` tous scénarios, `LeaderboardLoadState` inchangé). Test temporaire 17/17 verts, supprimé.
Problèmes mineurs : test CA7 de F00 vérifie encore le bouchon et ne démonte pas le composant (warning `NuxtLink`) ; héros au niveau max affiche « 100% to level 61 » (max 60) ; `app/features/leaderboard/README.md` décrit encore `RankingRowDetail` comme bouchon. À l'intégration de F02 : vérifier qu'un `h2` précède le `h3` « Hero · … ».

## Action attendue du manager
Aucune.
