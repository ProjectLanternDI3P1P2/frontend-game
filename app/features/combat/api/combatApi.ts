/**
 * The combat feature's API boundary (ADR-FE-009, ADR-FE-011): the only file of the
 * feature allowed to reach the Gateway.
 */
import type { FightActionRequest, FightResponse, StartFightRequest } from "../types";
import { useGateway } from "~/shared/composables/useGateway";

/** POST /api/v1/combats — opens a fight; idempotent on `idempotencyKey`. */
export function startFight(request: StartFightRequest): Promise<FightResponse> {
  return useGateway().post<FightResponse>("combats", request);
}

/** GET /api/v1/combats/{fightId} — the authoritative state, with the whole event log. */
export function fetchFight(fightId: string, signal?: AbortSignal): Promise<FightResponse> {
  return useGateway().get<FightResponse>(`combats/${encodeURIComponent(fightId)}`, {
    signal,
  });
}

/**
 * POST /api/v1/combats/{fightId}/actions — the active hero acts, then the monsters play.
 * Returns the new state with the events of this action only. 409 when refused.
 */
export function submitFightAction(
  fightId: string,
  action: FightActionRequest,
): Promise<FightResponse> {
  return useGateway().post<FightResponse>(
    `combats/${encodeURIComponent(fightId)}/actions`,
    action,
  );
}
