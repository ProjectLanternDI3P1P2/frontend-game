/**
 * State of one fight on screen.
 *
 * The service is the authority (ADR-FE-008): the player picks an action, the service
 * resolves it together with the monsters' turns and returns the events. The screen then
 * STAGES them beat by beat (see `combatChoreography.ts`): the attacker runs in and strikes,
 * the target recoils, the gauges go down, the attacker runs back. Then it settles on the
 * new state. A refused action (409) or a network error re-reads the fight.
 */
import { computed, onScopeDispose, ref, shallowRef } from "vue";
import {
  fetchFight,
  leaveCombat,
  onFightChanged,
  submitFightAction,
} from "../api/combatApi";
import { CombatHubError } from "../api/combatHub";
import { perform } from "../combatChoreography";
import type { CommandStep, Gauges, PendingAction } from "../combatRules";
import {
  activeHero,
  applyEvent,
  describeEvent,
  findCombatant,
  gaugesOf,
  groupIntoBeats,
  targetsFor,
} from "../combatRules";
import type {
  Ability,
  Combatant,
  CombatItem,
  FightActionRequest,
  FightEvent,
  FightResponse,
} from "../types";
import { useBattleStage } from "./useBattleStage";

export type CombatScreenStatus = "loading" | "ready" | "error";

const LOG_SIZE = 5;

export function useCombat(fightId: string) {
  const fight = shallowRef<FightResponse | null>(null);
  const gauges = ref<Record<string, Gauges>>({});
  const status = ref<CombatScreenStatus>("loading");
  const errorMessage = ref<string | null>(null);
  const step = ref<CommandStep>({ kind: "root" });
  const log = ref<string[]>([]);
  const announcement = ref("");
  /** True while a request is in flight or events are replaying: the panel is locked. */
  const busy = ref(false);
  /** The turn shown while replaying: the monster playing, not yet the next hero. */
  const shownTurnId = ref<string | null>(null);
  const stage = useBattleStage();

  const hero = computed(() =>
    fight.value && !busy.value ? activeHero(fight.value) : undefined,
  );
  const targets = computed(() =>
    fight.value && step.value.kind === "target"
      ? (targetsFor(fight.value, step.value.action) ?? [])
      : [],
  );
  const isOver = computed(
    () => fight.value !== null && fight.value.status !== "Active",
  );

  /** Seconds left to the hero's turn, from the server deadline (the server clock decides). */
  const secondsLeft = ref<number | null>(null);
  let ticker: ReturnType<typeof setInterval> | null = null;
  /** The last state pushed while a replay was running, applied once it is over. */
  let latestPush: FightResponse | null = null;
  let resyncOnDeadline = false;

  function tick(): void {
    const deadline = fight.value?.deadlineUtc;
    if (!deadline || isOver.value) {
      secondsLeft.value = null;
      return;
    }
    const left = Math.max(0, Math.ceil((Date.parse(deadline) - Date.now()) / 1000));
    secondsLeft.value = left;
    // At zero the server passes the turn on the next join: ask for it once.
    if (left === 0 && !busy.value && !resyncOnDeadline) {
      resyncOnDeadline = true;
      void resynchronise();
    }
  }

  async function start(): Promise<void> {
    status.value = "loading";
    errorMessage.value = null;
    try {
      onFightChanged((pushed) => {
        // Another client or the server changed the fight: its state wins. During a replay
        // the screen is staging its own action: the latest push waits for the end of it.
        if (busy.value) latestPush = pushed;
        else show(pushed);
      });
      show(await fetchFight(fightId));
      status.value = "ready";
      ticker ??= setInterval(tick, 250);
    } catch (error) {
      status.value = "error";
      errorMessage.value = describe(error);
    }
  }

  function dispose(): void {
    if (ticker) clearInterval(ticker);
    ticker = null;
    void leaveCombat();
  }

  onScopeDispose(dispose);

  function show(state: FightResponse): void {
    fight.value = state;
    resyncOnDeadline = false;
    gauges.value = gaugesOf(state);
    shownTurnId.value = state.activeCombatantId;
    stage.reset(
      [...state.heroes, ...state.monsters]
        .filter((c) => c.isKnockedOut)
        .map((c) => c.combatantId),
    );
  }

  // --- Command panel -------------------------------------------------------------------

  function openFight(): void {
    step.value = { kind: "fight" };
  }

  function openItems(): void {
    step.value = { kind: "items" };
  }

  function back(): void {
    step.value =
      step.value.kind === "target" && step.value.action.type === "Item"
        ? { kind: "items" }
        : step.value.kind === "target"
          ? { kind: "fight" }
          : { kind: "root" };
  }

  function attack(): void {
    chooseTarget({ type: "Attack" });
  }

  function useAbility(ability: Ability): void {
    chooseTarget({ type: "Ability", ability });
  }

  function useItem(item: CombatItem): void {
    chooseTarget({ type: "Item", item });
  }

  function defend(): Promise<void> {
    return act({ type: "Defend" });
  }

  function flee(): Promise<void> {
    return act({ type: "Flee" });
  }

  function pass(): Promise<void> {
    return act({ type: "Pass" });
  }

  /** Asks for a target, or acts at once when the action has none to pick. */
  function chooseTarget(action: PendingAction): void {
    if (!fight.value) return;
    const candidates = targetsFor(fight.value, action);
    if (candidates === null) {
      void act(toRequest(action));
    } else if (candidates.length === 1 && action.type !== "Item") {
      void act(toRequest(action, candidates[0]));
    } else {
      step.value = { kind: "target", action };
    }
  }

  function pickTarget(target: Combatant): Promise<void> | undefined {
    if (step.value.kind !== "target") return;
    if (!targets.value.some((c) => c.combatantId === target.combatantId)) return;
    return act(toRequest(step.value.action, target));
  }

  function toRequest(
    action: PendingAction,
    target?: Combatant,
  ): Omit<FightActionRequest, "commandId" | "actorId"> {
    const targetId = target?.combatantId;
    switch (action.type) {
      case "Attack":
        return { type: "Attack", targetId };
      case "Ability":
        return { type: "Ability", abilityId: action.ability.abilityId, targetId };
      case "Item":
        return { type: "Item", itemId: action.item.itemId, targetId };
    }
  }

  // --- Resolution ------------------------------------------------------------------------

  async function act(
    action: Omit<FightActionRequest, "commandId" | "actorId">,
  ): Promise<void> {
    const actor = hero.value;
    if (!actor || busy.value) return;

    busy.value = true;
    errorMessage.value = null;
    step.value = { kind: "root" };
    try {
      const updated = await submitFightAction(fightId, {
        ...action,
        commandId: crypto.randomUUID(),
        actorId: actor.combatantId,
      });
      await replay(updated);
      applyLatestPush();
    } catch (error) {
      errorMessage.value = describe(error);
      await resynchronise();
    } finally {
      busy.value = false;
    }
  }

  /**
   * A state pushed during the replay is newer than the answer when it moved on (a later
   * turn, or the end of the fight): then it replaces what the replay settled on.
   */
  function applyLatestPush(): void {
    const pushed = latestPush;
    latestPush = null;
    const current = fight.value;
    if (!pushed || !current) return;
    const movedOn =
      pushed.turn > current.turn ||
      (pushed.status !== "Active" && current.status === "Active");
    if (movedOn) show(pushed);
  }

  /** Stages the events of the last action beat by beat, then settles on the new state. */
  async function replay(updated: FightResponse): Promise<void> {
    const nameOf = (id: string | null) => findCombatant(updated, id)?.name ?? "";
    // Names and sprites of the new state; gauges still those before the action.
    fight.value = { ...updated, activeCombatantId: shownTurnId.value };

    const context = {
      fight: updated,
      stage,
      apply: (event: FightEvent) => {
        gauges.value = applyEvent(gauges.value, event);
        const line = describeEvent(event, nameOf);
        if (line) say(line);
      },
      turn: (id: string | null) => (shownTurnId.value = id),
    };
    for (const beat of groupIntoBeats(updated.events)) {
      await perform(beat, context);
    }
    show(updated);
  }

  function say(line: string): void {
    log.value = [...log.value, line].slice(-LOG_SIZE);
    // Re-announce identical messages: screen readers ignore unchanged text.
    announcement.value = "";
    queueMicrotask(() => (announcement.value = line));
  }

  /** The service refused or the outcome is unknown: its state wins (ADR-FE-008). */
  async function resynchronise(): Promise<void> {
    latestPush = null;
    try {
      show(await fetchFight(fightId));
    } catch (error) {
      errorMessage.value = describe(error);
    }
  }

  return {
    fight,
    gauges,
    status,
    errorMessage,
    step,
    log,
    announcement,
    busy,
    stage,
    shownTurnId,
    hero,
    targets,
    isOver,
    secondsLeft,
    start,
    dispose,
    pass,
    openFight,
    openItems,
    back,
    attack,
    useAbility,
    useItem,
    defend,
    flee,
    pickTarget,
  };
}

function describe(error: unknown): string {
  if (error instanceof CombatHubError) return error.message;
  return error instanceof Error ? error.message : "Unexpected error.";
}
