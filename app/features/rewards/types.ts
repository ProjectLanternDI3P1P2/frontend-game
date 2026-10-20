/** Contract of GET /api/v1/runs/:dungeonRunId/rewards (Reward service). */
export type RewardSourceType = "MONSTER" | "BOSS" | "CHEST";

/** UNIQUE: one recipient. SHARED_PER_PARTICIPANT: every eligible participant got a copy. */
export type RewardKind = "UNIQUE" | "SHARED_PER_PARTICIPANT";

export interface RewardRecipient {
  heroId: string;
  /** Null when the granting service did not provide it. */
  playerId: string | null;
  /** Null once the stack has been fully consumed. */
  itemInstanceId: string | null;
}

export interface DistributedReward {
  kind: RewardKind;
  itemId: string;
  name: string;
  /** Frozen at grant time; its casing is not guaranteed. */
  rarity: string;
  quantity: number;
  recipients: RewardRecipient[];
}

export interface RewardDistribution {
  sourceType: RewardSourceType;
  causeId: string;
  rewards: DistributedReward[];
}

export interface RunRewardSummary {
  dungeonRunId: string;
  distributions: RewardDistribution[];
}
