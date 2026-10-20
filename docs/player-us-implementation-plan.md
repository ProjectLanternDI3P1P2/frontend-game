# Plan d’implémentation — US-PLAYER-07 à US-PLAYER-11

## Sources vérifiées

- Les exports Azure DevOps fournis : US-PLAYER-07, 08, 09, 10 et 11.
- Le fichier Figma `Player`, section **Squad Player** : listes de héros,
  création, détail, confirmation de suppression, accueil de jeu et génération
  du donjon.
- `player-backend`, contrôleurs et contrats effectivement présents.

## Fondation livrée par cette branche

- `app/features/player/types.ts` : contrat TypeScript des réponses Player,
  classes actuellement supportées et états de session.
- `app/features/player/api/playerApi.ts` : client Gateway typé et testable pour
  les quatre routes existantes.
- `UiHeroCard` : carte présentatoire réutilisable par la liste, la sélection,
  le détail et le lancement de partie.
- `createIdempotencyKey()` : clé UUID à conserver pendant une même tentative
  de création ou de démarrage, pour respecter l’idempotence du backend.

Cette branche ne crée volontairement ni route, ni page, ni flux métier : les
cinq US restent livrables indépendamment depuis `dev` une fois cette base
fusionnée.

## US-PLAYER-07 — Créer un héros

1. Créer le dossier de fonctionnalité et la route de création CSR.
2. Construire le formulaire nom + choix parmi Warrior, Shaman et Mage ; afficher
   niveau 1, la première compétence et la santé fournis par la réponse.
3. Appeler `createHero` avec une clé d’idempotence stable pendant les retries.
4. Mapper les erreurs 400 (nom/classe) et 409 (limite de dix héros) en erreurs
   de champ ou en message global ; tester succès, rejouage et refus.

## US-PLAYER-08 — Lister et sélectionner mes héros

1. Créer une liste CSR fondée sur `listHeroes` et `UiHeroCard`.
2. Afficher nom, classe, niveau, PV et état de session ; sélectionner un héros
   non engagé dans l’état client de l’écran.
3. Respecter l’ordre reçu (le backend est l’autorité) et le compteur `/10`.
4. Tester chargement, vide, sélection et héros déjà en session.

## US-PLAYER-09 — Voir la fiche d’un héros

1. Créer la route de détail et charger `getHeroSheet`.
2. Afficher identité, classe, niveau, attributs, PV calculés et compétences.
3. Réserver une zone dégradée explicitement signalée pour l’équipement et
   l’inventaire lorsque Rewards sera intégré ; garder la partie Player lisible.
4. Tester données Player complètes et indisponibilité partielle de Rewards.

## US-PLAYER-10 — Supprimer un héros

1. Construire la confirmation Figma (saisie du nom, action destructive,
   progression et erreurs) seulement après publication du contrat backend.
2. À ce jour, `player-backend` ne contient ni endpoint HTTP `DELETE`, ni
   commande/handler de suppression : aucun appel ne doit être inventé.
3. Une fois le contrat disponible, ajouter son type et sa fonction API dans la
   même PR que le backend, puis tester les cas héros libre, session active et
   rejouage idempotent.

## US-PLAYER-11 — Démarrer une partie solo

1. Composer l’accueil de jeu depuis le héros sélectionné et `UiHeroCard`.
2. Appeler `startSoloRun` avec une clé d’idempotence stable ; désactiver le
   déclencheur tant que l’intention est en cours.
3. Rendre `Active` comme transition vers le donjon ; rendre `Failed` ou
   `Pending` comme état explicite de génération, jamais comme succès implicite.
4. Tester succès, replay, héros déjà engagé, indisponibilité Dungeon et
   l’affichage de la raison d’échec.

## Écarts à résoudre avant les écrans finaux

| Sujet        | Figma                         | US / backend                                | Décision appliquée                                                                                                  |
| ------------ | ----------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Classes      | Warrior, Mage, Ranger, Rogue  | Warrior, Shaman, Mage                       | Le contrat backend prévaut ; mettre la maquette à jour ou faire évoluer le backend avant l’implémentation visuelle. |
| Détail héros | Inclut équipement/progression | Player ne fournit pas équipement/inventaire | Afficher seulement Player ; intégrer les autres services en dégradation explicite.                                  |
| Suppression  | États complets dessinés       | Aucun endpoint implémenté                   | Bloquée côté intégration jusqu’au contrat de suppression.                                                           |
