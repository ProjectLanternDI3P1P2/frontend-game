/**
 * The combat feature's API boundary (ADR-FE-009, ADR-FE-011): with the Hub adapter it
 * delegates to, the only code of the feature allowed to reach the Gateway. A fight is
 * opened by the Dungeon service on a contact (never by the client); the client joins it
 * and plays it over the Combat Hub.
 */
import type { FightActionRequest, FightResponse } from "../types";
import { CombatHubClient, combatHubUrl } from "./combatHub";

/** One WebSocket per tab, opened on the first call. */
let combatHub: CombatHubClient | null = null;
let stateListener: ((fight: FightResponse) => void) | null = null;

function useCombatHub(): CombatHubClient {
  combatHub ??= new CombatHubClient(
    combatHubUrl(useRuntimeConfig().public.apiGatewayUrl),
    (fight) => stateListener?.(fight),
  );
  return combatHub;
}

/** `JoinCombat` — the authoritative state with its whole log; calling it again resynchronizes. */
export function fetchFight(fightId: string): Promise<FightResponse> {
  return useCombatHub().joinCombat(fightId);
}

/** `SubmitAction` / `PassTurn` — the new state with the events of this action only. */
export function submitFightAction(
  fightId: string,
  action: FightActionRequest,
): Promise<FightResponse> {
  return useCombatHub().submitAction(fightId, action);
}

/** `CombatStateChanged` pushed to the fight's group (another tab, a timeout...). */
export function onFightChanged(
  listener: ((fight: FightResponse) => void) | null,
): void {
  stateListener = listener;
}

export async function leaveCombat(): Promise<void> {
  stateListener = null;
  await combatHub?.disconnect();
  combatHub = null;
}
