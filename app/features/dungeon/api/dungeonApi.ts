/**
 * The dungeon feature's API boundary (ADR-FE-009, ADR-FE-011): the only file
 * of the feature allowed to reach the Gateway.
 */
import type {
  CreateDungeonRunRequest,
  Direction,
  DungeonMapResponse,
  DungeonRunResponse,
} from "../types";
import { useGateway } from "~/shared/composables/useGateway";

/** POST /api/v1/dungeon-runs — generates a dungeon on a fresh seed. */
export function createDungeonRun(
  request: CreateDungeonRunRequest,
): Promise<DungeonRunResponse> {
  return useGateway().post<DungeonRunResponse>("dungeon-runs", request);
}

/** GET /api/v1/dungeon-runs/{runId} — the authoritative run state. */
export function fetchDungeonRun(
  runId: string,
  signal?: AbortSignal,
): Promise<DungeonRunResponse> {
  return useGateway().get<DungeonRunResponse>(
    `dungeon-runs/${encodeURIComponent(runId)}`,
    { signal },
  );
}

/** POST /api/v1/dungeon-runs/{runId}/moves — one tile, one turn. 409 if blocked. */
export function moveHero(
  runId: string,
  direction: Direction,
): Promise<DungeonRunResponse> {
  return useGateway().post<DungeonRunResponse>(
    `dungeon-runs/${encodeURIComponent(runId)}/moves`,
    { direction },
  );
}

/** POST /api/v1/dungeon-runs/{runId}/descents — takes the stairs down. */
export function takeStairsDown(runId: string): Promise<DungeonRunResponse> {
  return useGateway().post<DungeonRunResponse>(
    `dungeon-runs/${encodeURIComponent(runId)}/descents`,
  );
}

/**
 * POST /api/v1/dungeon-runs/{runId}/boss-defeats — records the defeat of the
 * current floor's boss: its gate opens, and the run is won on the last floor.
 * Combat's to call once the fight exists; the explorer calls it meanwhile.
 * 409 when the hero is not in the boss room.
 */
export function defeatFloorBoss(runId: string): Promise<DungeonRunResponse> {
  return useGateway().post<DungeonRunResponse>(
    `dungeon-runs/${encodeURIComponent(runId)}/boss-defeats`,
  );
}

/**
 * GET /api/v1/dungeons/{seed}/map?floor=n — a whole floor in about 25 KB
 * (3 KB gzipped). Immutable: it is fetched once per floor and cached forever.
 */
export function fetchDungeonMap(
  seed: string,
  floor: number,
  signal?: AbortSignal,
): Promise<DungeonMapResponse> {
  return useGateway().get<DungeonMapResponse>(
    `dungeons/${encodeURIComponent(seed)}/map`,
    { query: { floor }, signal },
  );
}
