/**
 * Provisional front-end catalogue of hero statistics (decision D1).
 *
 * Inspired by the events published on RabbitMQ (`deploy/rabbitmq/definitions.json`):
 * game sessions, dungeon runs, rooms, chests, combats, actions, consumables,
 * rewards, purchases and equipment changes. The keys are a draft until the
 * leaderboard service publishes its contract.
 */
import { StatisticCategory, type StatisticDefinition } from "./types";

/** Display order of the categories. */
export const STATISTIC_CATEGORIES: readonly {
  category: StatisticCategory;
  label: string;
}[] = [
  { category: StatisticCategory.GAMES, label: "Games" },
  { category: StatisticCategory.DUNGEON, label: "Dungeon" },
  { category: StatisticCategory.COMBAT, label: "Combat" },
  { category: StatisticCategory.REWARDS, label: "Rewards" },
];

export const STATISTICS_CATALOGUE: readonly StatisticDefinition[] = [
  // player.game-session-*
  { key: "games_played", label: "Games played", category: StatisticCategory.GAMES },
  {
    key: "games_completed",
    label: "Games completed",
    category: StatisticCategory.GAMES,
  },
  { key: "lobbies_joined", label: "Lobbies joined", category: StatisticCategory.GAMES },
  // dungeon.*
  {
    key: "dungeons_started",
    label: "Dungeons started",
    category: StatisticCategory.DUNGEON,
  },
  {
    key: "dungeons_completed",
    label: "Dungeons completed",
    category: StatisticCategory.DUNGEON,
  },
  {
    key: "rooms_explored",
    label: "Rooms explored",
    category: StatisticCategory.DUNGEON,
  },
  { key: "chests_opened", label: "Chests opened", category: StatisticCategory.DUNGEON },
  // combat.*
  {
    key: "combats_fought",
    label: "Combats fought",
    category: StatisticCategory.COMBAT,
  },
  { key: "combats_won", label: "Combats won", category: StatisticCategory.COMBAT },
  {
    key: "actions_performed",
    label: "Actions performed",
    category: StatisticCategory.COMBAT,
  },
  {
    key: "consumables_used",
    label: "Consumables used",
    category: StatisticCategory.COMBAT,
  },
  // rewards.*
  {
    key: "rewards_earned",
    label: "Rewards earned",
    category: StatisticCategory.REWARDS,
  },
  {
    key: "items_consumed",
    label: "Items consumed",
    category: StatisticCategory.REWARDS,
  },
  {
    key: "purchases_made",
    label: "Purchases made",
    category: StatisticCategory.REWARDS,
  },
  {
    key: "equipment_changes",
    label: "Equipment changes",
    category: StatisticCategory.REWARDS,
  },
];
