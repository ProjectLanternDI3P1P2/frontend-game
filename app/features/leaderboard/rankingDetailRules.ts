/**
 * Pure display rules of the expanded ranking row and its facts drawer (F03).
 */
import { formatCount } from "./statisticsRules";
import { FactStatus, RunOutcome } from "./types";

/** Outcome as text, never only as a colour (RGAA). */
export const RUN_OUTCOME_LABELS: Record<RunOutcome, string> = {
  [RunOutcome.VICTORY]: "Victory",
  [RunOutcome.DEFEAT]: "Defeat",
  [RunOutcome.ABANDONED]: "Abandoned",
};

/** Fact status as text, never only as a colour (RGAA). */
export const FACT_STATUS_LABELS: Record<FactStatus, string> = {
  [FactStatus.APPLIED]: "Applied",
  [FactStatus.PENDING]: "Pending",
  [FactStatus.REJECTED]: "Rejected",
};

export const NO_RUN_YET = "No run yet";

/** 1234 → "1,234" (same locale as the statistics); not a number → "0". */
export function formatNumber(value: number): string {
  return formatCount(Number.isFinite(value) ? value : 0);
}

/** Progress inside the level, clamped to 0..100 (whole percent). */
export function xpPercent(xpIntoLevel: number, xpForNextLevel: number): number {
  if (!Number.isFinite(xpIntoLevel) || !Number.isFinite(xpForNextLevel)) return 0;
  if (xpForNextLevel <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, xpIntoLevel / xpForNextLevel));
  return Math.round(ratio * 100);
}

/** "1,200 / 3,000 XP". */
export function formatXpProgress(xpIntoLevel: number, xpForNextLevel: number): string {
  return `${formatNumber(xpIntoLevel)} / ${formatNumber(xpForNextLevel)} XP`;
}

/** "7 / 12". */
export function formatRoom(room: number, maxRoom: number): string {
  return `${room} / ${maxRoom}`;
}

/** "+120 XP" for a gain, "0 XP" otherwise. */
export function formatXpGain(xp: number): string {
  const value = Number.isFinite(xp) ? xp : 0;
  return `${value > 0 ? "+" : ""}${formatNumber(value)} XP`;
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** ISO → "21 Oct 2026"; missing or invalid → "Unknown". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "Unknown";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "Unknown" : DATE_FORMAT.format(date);
}

/** Public profile (D12); none for a deleted player. */
export function publicProfilePath(playerId: string | null | undefined): string | null {
  return playerId ? `/players/${encodeURIComponent(playerId)}/heroes` : null;
}
