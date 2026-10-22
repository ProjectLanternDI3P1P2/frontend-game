/**
 * How each beat of a fight is played on the stage: who runs where, which pose, which
 * effect, and when the gauges move. The outcome is already known (the service resolved
 * it); this only stages it, so that the player SEES the hero run in and strike, the slime
 * recoil, the fireball fly across the room.
 */
import type { Beat } from "./combatRules";
import { abilityStyle, findCombatant, isHeavyHit } from "./combatRules";
import type { BattleStage } from "./composables/useBattleStage";
import { TIMING } from "./composables/useBattleStage";
import type { FightEvent, FightResponse } from "./types";

export interface ChoreographyContext {
  /** The state after the action: names, sides and abilities of the fighters. */
  fight: FightResponse;
  stage: BattleStage;
  /** Moves the gauges by one event and writes it to the log. */
  apply: (event: FightEvent) => void;
  /** Shows whose turn it is. */
  turn: (combatantId: string | null) => void;
}

export async function perform(beat: Beat, context: ChoreographyContext): Promise<void> {
  const { head } = beat;
  const { stage, apply } = context;

  switch (head.type) {
    case "TurnStarted":
      context.turn(head.actorId);
      apply(head);
      await stage.wait(TIMING.pause);
      return;

    case "Attacked":
      apply(head);
      await melee(beat, context, false);
      return;

    case "AbilityUsed":
      apply(head);
      await ability(beat, context);
      return;

    case "ItemUsed":
      apply(head);
      await drink(beat, context);
      return;

    case "Defended":
      apply(head);
      stage.pose(head.actorId, "guard");
      stage.play("shield", head.actorId, 900);
      await stage.wait(500);
      return;

    case "FleeFailed":
      apply(head);
      await tryToFlee(head.actorId, context);
      return;

    case "Fled":
      apply(head);
      await flee(context);
      return;

    case "Victory":
      apply(head);
      for (const hero of standing(context, "Hero")) stage.pose(hero, "cheer");
      await stage.wait(1000);
      return;

    default:
      apply(head);
      await stage.wait(700);
  }
}

/** Runs to the target, strikes, the target reacts, runs back. */
async function melee(beat: Beat, context: ChoreographyContext, isSkill: boolean): Promise<void> {
  const { stage } = context;
  const actor = beat.head.actorId;
  const target = beat.head.targetId;
  if (!actor || !target) {
    react(beat.effects, context);
    return;
  }

  const isHero = findCombatant(context.fight, actor)?.side === "Hero";

  stage.pose(actor, "run");
  stage.place(actor, { near: target });
  await stage.wait(TIMING.run);

  stage.pose(actor, "strike");
  await stage.wait(TIMING.windUp);
  stage.play(isHero ? "slash" : "claw", target, 380);
  stage.play("impact", target, 300);
  if (isSkill) stage.shakeBoard();
  const knockedOut = await strikeHome(beat.effects, context);
  await stage.wait(TIMING.strike);

  stage.face(actor, true);
  stage.pose(actor, "run");
  stage.place(actor, null);
  settle(beat.effects, context);
  await stage.wait(TIMING.run);
  stage.face(actor, false);
  stage.rest(actor);

  await knockOut(knockedOut, context);
}

async function ability(beat: Beat, context: ChoreographyContext): Promise<void> {
  const { stage } = context;
  const { head } = beat;
  const caster = findCombatant(context.fight, head.actorId);
  const known = caster?.abilities.find((a) => a.name === head.label);
  const style = abilityStyle(head.label, known?.target);

  // Every ability starts by gathering power: a magic circle under the caster.
  stage.pose(head.actorId, "cast");
  stage.play("aura", head.actorId, TIMING.cast + 200);
  await stage.wait(TIMING.cast);

  switch (style) {
    case "melee":
      return melee(beat, context, true);

    case "fireball": {
      stage.play("fireball", head.targetId, TIMING.projectile, head.actorId ?? undefined);
      await stage.wait(TIMING.projectile);
      stage.play("explosion", head.targetId, 450);
      stage.shakeBoard();
      break;
    }

    case "frost":
      for (const hit of beat.effects.filter((e) => e.type === "Damaged")) {
        stage.play("frost", hit.targetId, 650);
      }
      stage.shakeBoard();
      break;

    case "heal":
      stage.play("heal", head.targetId, 900);
      break;

    case "shield":
      stage.play("shield", head.actorId, 900);
      break;
  }

  const knockedOut = await strikeHome(beat.effects, context);
  await stage.wait(TIMING.react);
  settle(beat.effects, context);
  stage.rest(head.actorId);
  await knockOut(knockedOut, context);
}

async function drink(beat: Beat, context: ChoreographyContext): Promise<void> {
  const { stage } = context;
  const { head } = beat;
  stage.pose(head.actorId, "cast");
  stage.play("potion", head.targetId, 800);
  await stage.wait(300);
  react(beat.effects, context);
  await stage.wait(TIMING.react + 150);
  stage.rest(head.actorId);
}

/** The hero turns and runs, then stops short and comes back. */
async function tryToFlee(actor: string | null, context: ChoreographyContext): Promise<void> {
  const { stage } = context;
  if (!actor) return;
  stage.face(actor, true);
  stage.pose(actor, "run");
  stage.place(actor, { offScreen: true });
  await stage.wait(260);
  stage.place(actor, null);
  await stage.wait(TIMING.run);
  stage.face(actor, false);
  stage.rest(actor);
}

async function flee(context: ChoreographyContext): Promise<void> {
  const { stage } = context;
  for (const hero of standing(context, "Hero")) {
    stage.face(hero, true);
    stage.pose(hero, "run");
    stage.place(hero, { offScreen: true });
  }
  await stage.wait(900);
}

/**
 * The targets take the blow: pose, numbers, gauges, a shake on a heavy hit. Returns the
 * fighters knocked out, who fall once the attacker has left.
 */
function react(effects: readonly FightEvent[], context: ChoreographyContext): FightEvent[] {
  const { stage } = context;
  const knockedOut: FightEvent[] = [];
  for (const effect of effects) {
    const target = findCombatant(context.fight, effect.targetId);
    switch (effect.type) {
      case "Damaged": {
        const heavy = target ? isHeavyHit(effect.amount, target.maxHp) : false;
        stage.pose(effect.targetId, "hurt");
        stage.pop(
          effect.targetId,
          effect.isCritical ? `${effect.amount}!` : String(effect.amount),
          effect.isCritical ? "crit" : heavy ? "heavy" : "damage",
        );
        if (heavy || effect.isCritical) stage.shakeBoard();
        if (target?.side === "Hero" && (heavy || effect.isCritical)) stage.flashScreen();
        break;
      }
      case "Missed":
        stage.pose(effect.targetId, "dodge");
        stage.pop(effect.targetId, "Miss", "miss");
        break;
      case "Healed":
        stage.pop(effect.targetId, `+${effect.amount}`, "heal");
        if (effect.label?.toLowerCase().includes("potion") === false) {
          stage.play("heal", effect.targetId, 700);
        }
        break;
      case "ManaRestored":
        stage.play("mana", effect.targetId, 700);
        stage.pop(effect.targetId, `+${effect.amount}`, "mana");
        break;
      case "KnockedOut":
        knockedOut.push(effect);
        continue;
    }
    context.apply(effect);
  }
  return knockedOut;
}

/**
 * The blow lands. A critical hit first freezes the action for an instant, punches the
 * camera in and bursts into rays: then the targets react.
 */
async function strikeHome(
  effects: readonly FightEvent[],
  context: ChoreographyContext,
): Promise<FightEvent[]> {
  const { stage } = context;
  const critical = effects.find((e) => e.type === "Damaged" && e.isCritical);
  if (critical) {
    stage.play("critical", critical.targetId, 650);
    stage.play("shockwave", critical.targetId, 520);
    stage.punchIn(critical.targetId);
    await stage.wait(TIMING.hitStop);
  }
  return react(effects, context);
}

/** The targets still standing recover from the blow. */
function settle(effects: readonly FightEvent[], context: ChoreographyContext): void {
  const knockedOut = new Set(
    effects.filter((e) => e.type === "KnockedOut").map((e) => e.targetId),
  );
  for (const effect of effects) {
    const recovers = effect.type === "Damaged" || effect.type === "Missed";
    if (recovers && !knockedOut.has(effect.targetId)) {
      context.stage.rest(effect.targetId);
    }
  }
}

/** The fighters knocked out fall, in a puff of smoke. */
async function knockOut(events: readonly FightEvent[], context: ChoreographyContext): Promise<void> {
  if (events.length === 0) return;
  for (const event of events) {
    context.stage.pose(event.targetId, "down");
    context.stage.play("smoke", event.targetId, TIMING.knockOut + 200);
    context.apply(event);
  }
  await context.stage.wait(TIMING.knockOut);
}

function standing(context: ChoreographyContext, side: "Hero" | "Monster"): string[] {
  const list = side === "Hero" ? context.fight.heroes : context.fight.monsters;
  return list.filter((c) => !c.isKnockedOut).map((c) => c.combatantId);
}
