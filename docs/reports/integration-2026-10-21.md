# Intégration 2026-10-21 - PRÊTE

## F00 - Fondation du classement par héros (contrat, clients, mocks, règles) : mergée
Tests : `npx vitest run app/features/leaderboard` → 13 fichiers, 268 tests verts.
Conflits : Aucun (merge `--no-ff` de `feature/f00-leaderboard-ranking-foundation`, commit c71020a ; F00 était déjà basée sur la tête F01 du lot).

## Suite complète
`npm run lint` → OK ; `npm run typecheck` → OK ; `npm run test:unit` → 32 fichiers, 429 tests verts (2026-10-21, commit c71020a).

## Tester
Verdict : OK. Aucune régression F00/F01 : sources statistiques F01 inchangées, tests F01 CA1 à CA6 identiques octet pour octet, CA7/8/10/12/13 adaptés et verts, CA9 retiré (autorisé par F00 CA8). `/leaderboard` vérifiée (top 10, badge « You », état vide, un seul h1). Test temporaire d'interactions (scénarios `?mock=`, watcher `useLeaderboard`, heroId simulé sur la page statistiques) : 18/18 verts, supprimé ensuite.
Problème mineur connu : `app/features/leaderboard/tests/F01AcceptanceTest.spec.ts` n'est pas au format Prettier (défaut antérieur à F00) ; le prochain commit qui le touchera sera reformaté par lint-staged.

## Action attendue du manager
Aucune.
