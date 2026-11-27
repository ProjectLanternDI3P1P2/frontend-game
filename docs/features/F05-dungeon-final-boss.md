# F05 - Boss final du donjon : invariant, états dégradés et preuves (US-DONGEON-07, #266)

## Cadre

Sensible : oui (validation d'une entrée externe : les données d'étage renvoyées par la Gateway dungeon)
Revue : approfondie
Dépend de : Aucune
Taille estimée : ~400 lignes de diff (tests compris)
Fichier d'acceptation : `app/features/dungeon/tests/F05AcceptanceTest.spec.ts`

## Objectif

Chaque étage doit se terminer par un boss final, un seul, placé par le back à partir de la seed. L'affichage nominal du boss existe déjà (types `boss`, sprite, porte verrouillée, minimap). Cette fiche le rend fiable et prouvé côté front : le front vérifie l'invariant du boss sur les données reçues, affiche un état explicite quand il est rompu ou quand l'étage ne se charge pas, reste aligné sur le serveur après rechargement ou erreur, et relie chaque critère de l'US à un test.

## Critères d'acceptation

Tâches Azure entre crochets. « US CAn » = critère de l'US #266.

Invariant du boss — règle pure (ex. `findFloorBoss(floor)` dans `app/features/dungeon/bossRules.ts`) [#1084]

- [ ] CA1 (US CA1) : pour un étage dont une seule salle est de type `boss` et qui contient un seul élément `boss` dans cette salle, la règle renvoie la position du boss (`x`, `y`, `roomId`, `elementId`). Vérifié sur les deux fixtures existantes `tests/fixtures/map-*-f0.json`.
- [ ] CA2 (US CA2) : la règle renvoie un résultat d'échec typé, sans lever d'exception, dans chacun de ces cas : aucun élément `boss` (`missing`) ; plus d'un élément `boss` (`duplicate`) ; élément `boss` hors de la salle de type `boss`, aucune salle `boss`, ou plusieurs salles `boss` (`misplaced`). Un test par cas.
- [ ] CA3 (US CA3) : même seed et même étage → même position. Deux décodages indépendants de la même réponse, et deux chargements successifs de l'explorateur (cache par seed de `useDungeonFloor`), renvoient une position strictement identique, égale à celle de l'élément reçu (le front ne la recalcule jamais).

Affichage et état explicite [#1085]

- [ ] CA4 (US CA4) : héros dans la salle de type `boss` → l'explorateur expose la position du boss (ex. `floorBoss`) et `canFightBoss` vaut `true` ; hors de cette salle, `canFightBoss` vaut `false`. Le plateau affiche exactement un boss, à cette position, et plus aucun une fois `floorBossDefeated` vrai.
- [ ] CA5 : invariant rompu (CA2) : l'exploration reste affichée, avec un message explicite (`role="alert"`, ex. « The final boss of this floor could not be located. ») et un bouton « Reload floor » qui relit le run et l'étage. Si la relecture renvoie un étage valide, le message disparaît.

Chargement de l'étage [#1086]

- [ ] CA6 : échec du chargement initial (run ou étage) : message d'erreur explicite (`role="alert"`) et bouton « Retry » qui relance le chargement ; le chargement est annoncé (`aria-live="polite"`) ; un succès au second essai affiche l'exploration et efface l'erreur.
- [ ] CA7 : un clic sur « Retry » ou « Reload floor » pendant un chargement en cours ne lance pas de second chargement (bouton désactivé, une seule requête par ressource).

Synchronisation avec le serveur [#1087]

- [ ] CA8 : après un rechargement de la page ou une resynchronisation après erreur, l'affichage du boss suit uniquement le run relu : `floorBossDefeated` vrai côté serveur → boss retiré et porte ouverte ; faux → boss affiché. Test : `defeatFloorBoss` échoue, la relecture du run indique le boss vaincu → le boss n'est plus affiché, aucun état n'est supposé localement.
- [ ] CA9 : double soumission : deux pas rapprochés vers le boss n'envoient qu'un seul `POST boss-defeats`.

Preuves et documentation [#1088]

- [ ] CA10 : `F05AcceptanceTest.spec.ts` contient un `describe("CAn — …")` par critère ci-dessus ; des tests de composant (montage de la page ou du plateau avec l'API mockée) couvrent : boss affiché seulement dans la salle `boss`, un seul boss, message d'invariant rompu, erreur de chargement + retry.
- [ ] CA11 : `app/features/dungeon/README.md` gagne une section « Final boss » : l'invariant, les états dégradés, la synchronisation, et un tableau « ce que les tests prouvent / ne prouvent pas » (CA de l'US #266 ↔ tests ; le déterminisme de la génération par la seed est prouvé côté back, pas ici ; les fixtures peuvent dériver du contrat). `npm run lint`, `npm run typecheck`, `npm run test:unit` et `npm run format:check` passent.

## Périmètre

Fichiers possédés :

- `app/features/dungeon/bossRules.ts` (nouveau)
- `app/features/dungeon/composables/useDungeonExplorer.ts` (position du boss, état d'invariant, `retry`/`reloadFloor`, garde contre les chargements concurrents)
- `app/pages/dungeon/[runId].vue` : uniquement les messages et boutons des CA5 à CA7
- `app/features/dungeon/tests/F05AcceptanceTest.spec.ts`, `app/features/dungeon/tests/bossRules.spec.ts`, ajouts dans `app/features/dungeon/tests/useDungeonExplorer.spec.ts`, nouveaux tests de composant dans `app/features/dungeon/tests/`
- `app/features/dungeon/README.md`

Fichiers en lecture seule : `app/shared/**`, `app/features/dungeon/api/**`, `app/features/dungeon/types.ts`, `app/features/dungeon/dungeonMap.ts`, `app/features/dungeon/components/**`, `app/features/dungeon/tests/fixtures/*.json` existants, `server/**`, `app/plugins/**`.
Hors périmètre : le back (génération, placement par seed, unicité côté serveur) ; le numéro « 40 » ; l'écran de combat, le retry du combat et le comportement du boss (squad Combat) ; la télémétrie (modification de l'endpoint partagé) ; l'E2E Cypress (#1089, fiche F06 ultérieure).

## Contrats partagés

Fournis : Aucun
Utilisés : contrat Gateway dungeon existant (`DungeonMapResponse`, `DungeonRunResponse`, `fetchDungeonMap`, `defeatFloorBoss`), inchangé.

## Contexte utile

- Décisions : D21 (pas de « salle 40 » codée en dur : le boss se repère par la salle et l'élément de type `boss`), D22 (combat hors périmètre), D24 (périmètre resserré, remplace D23). ADR-FE-008 (le back fait autorité ; relire après action ou erreur, ne jamais supposer), ADR-FE-009 (ne pas modifier la feature d'une autre squad), ADR-FE-012 (Vitest).
- Existant : `canFightBoss` (l. ~132 de `useDungeonExplorer.ts`), `fightBoss()` (l. ~315, verrou `isFighting` + garde de génération), `resynchronise()` (relit le run après erreur), `start()` (l. ~155, statut `loading | ready | error`). La page affiche déjà « Opening the dungeon… » et un `role="alert"` en erreur, sans bouton de reprise. Le modèle d'état dégradé à suivre est celui des coffres (`retryChestLoot`, compteur de génération contre les réponses obsolètes).
- `decodeFloor` lève `DungeonContractError` pour les ruptures structurelles (lignes, symboles) : ne pas mélanger. L'invariant du boss est un résultat typé, pour garder l'exploration affichée.
- Un test existant (`dungeonMap.spec.ts` l. ~37) vérifie déjà « 1 boss » sur les fixtures : ne pas le dupliquer, le compléter par les cas d'échec.
- Tests : `vi.mock("../api/dungeonApi")` + fixtures (modèle : test « fights the boss when the hero walks into it », `useDungeonExplorer.spec.ts` l. ~217). Fixtures d'échec construites en mémoire à partir des fixtures existantes (ne pas modifier celles-ci, elles viennent du back). Aucun appel réseau réel.
- Fixtures : 10 salles par étage, boss en salle `id 8`.
- Libellés d'interface en anglais. RGAA : focus visible, information pas seulement par la couleur, un seul `h1`.
- Pas de nouvelle dépendance npm.

## Questions ouvertes

Aucune.
