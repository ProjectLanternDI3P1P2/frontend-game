/**
 * Pure presentation rules for hero statistics (ADR-FE-012, decision D3).
 * No framework, no I/O: the backend owns the figures, these only shape them.
 */
import { STATISTIC_CATEGORIES, STATISTICS_CATALOGUE } from "./statisticsCatalogue";
import type {
  HeroStatisticsResponse,
  StatisticDefinition,
  StatisticGroup,
} from "./types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function toCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Every catalogue statistic, grouped by category in catalogue order. A key the
 * response does not carry is worth 0; a key unknown to the catalogue is ignored.
 */
export function groupHeroStatistics(
  response: Pick<HeroStatisticsResponse, "statistics"> | null | undefined,
  catalogue: readonly StatisticDefinition[] = STATISTICS_CATALOGUE,
): StatisticGroup[] {
  const values = new Map<string, number>();
  for (const statistic of response?.statistics ?? []) {
    if (!values.has(statistic.key)) values.set(statistic.key, toCount(statistic.value));
  }

  return STATISTIC_CATEGORIES.map(({ category, label }) => ({
    category,
    label,
    statistics: catalogue
      .filter((definition) => definition.category === category)
      .map((definition) => ({ ...definition, value: values.get(definition.key) ?? 0 })),
  })).filter((group) => group.statistics.length > 0);
}

/** The consolidation date, or null when absent or not a valid date. */
export function parseConsolidationDate(
  consolidatedAt: string | null | undefined,
): Date | null {
  if (!consolidatedAt) return null;
  const date = new Date(consolidatedAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Updated 3 min ago" from the consolidation date, relative to `now`. */
export function formatConsolidationAge(
  consolidatedAt: string | null | undefined,
  now: Date = new Date(),
): string {
  const date = parseConsolidationDate(consolidatedAt);
  if (!date) return "Not consolidated yet";
  const time = date.getTime();

  const elapsed = Math.max(0, now.getTime() - time);
  if (elapsed < MINUTE) return "Updated just now";
  if (elapsed < HOUR) return `Updated ${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `Updated ${Math.floor(elapsed / HOUR)} h ago`;
  const days = Math.floor(elapsed / DAY);
  return `Updated ${days} ${days === 1 ? "day" : "days"} ago`;
}

const countFormat = new Intl.NumberFormat("en-GB");

/** "12,450" — grouping only, never a unit. */
export function formatCount(value: number): string {
  return countFormat.format(value);
}
