# Reward feature

This feature owns the presentation of rewards received by the player. Chest
interaction rules remain in Dungeon: the frontend calls Dungeon, Dungeon validates
and persists the opening, then synchronously asks Reward for the immutable loot.

`components/ChestLootModal.vue` displays the loading, error, replay and item states
returned by that flow. It does not call the Reward API directly and does not add the
items to an inventory.
