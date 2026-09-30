/**
 * ADR-FE-008 — Request cache for floors.
 *
 * A floor is fully determined by its seed, so it never goes stale: it is
 * fetched once per session, decoded and autotiled once, then shared by every
 * screen. Concurrent requests for the same floor share one promise. A failed
 * load is evicted so that it can be retried.
 *
 * The decoded floor holds typed arrays of ~17,000 tiles: `markRaw` keeps Vue
 * from making them deeply reactive, which would cost far more than the
 * rendering itself.
 */
import { markRaw } from "vue";
import { fetchDungeonMap } from "../api/dungeonApi";
import type { DecodedFloor } from "../dungeonMap";
import { decodeFloor } from "../dungeonMap";
import type { RenderedLayer } from "../tiles/autotile";
import { renderFloor } from "../tiles/autotile";

export interface LoadedFloor {
  floor: DecodedFloor;
  /** Precomputed layers of every tile, indexed like `floor.cells`. */
  tiles: readonly (readonly RenderedLayer[])[];
}

const floors = new Map<string, Promise<LoadedFloor>>();

export function loadFloor(seed: string, floor: number): Promise<LoadedFloor> {
  const key = `${seed}#${floor}`;
  const cached = floors.get(key);
  if (cached) return cached;

  const pending = fetchDungeonMap(seed, floor).then((map) => {
    const decoded = decodeFloor(map);
    return markRaw({ floor: decoded, tiles: renderFloor(decoded) });
  });
  pending.catch(() => floors.delete(key));
  floors.set(key, pending);
  return pending;
}

/** Loads a floor in the background, e.g. the one below as soon as possible. */
export function prefetchFloor(seed: string, floor: number): void {
  loadFloor(seed, floor).catch(() => {
    // Best effort: the real load will retry and report the error.
  });
}

/** For tests only. */
export function clearFloorCache(): void {
  floors.clear();
}
