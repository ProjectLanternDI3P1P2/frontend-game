/**
 * Gameplay of a fight over the Combat service's SignalR Hub (`/hubs/combats`,
 * ADR-GLOB-010). Every call answers an explicit acknowledgement: accepted with the
 * fight snapshot (and the events of this command), or refused with the reason and
 * nothing changed. The snapshot is mapped here to the screen model (`FightResponse`),
 * so the rest of the feature never sees the wire format (ADR-FE-011).
 */
import {
  SignalRHubClient,
  SignalRHubError,
  signalRHubUrl,
} from "~/shared/api/signalRHubClient";
import type { HeroAppearance, HeroHairStyle } from "~/features/player/appearance";
import type {
  CombatCommandResultWire,
  CombatEventWire,
  CombatFighterWire,
  CombatSnapshotWire,
  Combatant,
  FightActionRequest,
  FightEvent,
  FightEventType,
  FightResponse,
  FightStatus,
} from "../types";

/** A refusal of the Combat Hub, with its code: validation, notFound, refused, conflict, internal. */
export class CombatHubError extends SignalRHubError {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "CombatHubError";
  }
}

export class CombatHubClient {
  private readonly hub: SignalRHubClient;

  constructor(hubUrl: string, onCombatStateChanged?: (fight: FightResponse) => void) {
    this.hub = new SignalRHubClient(hubUrl, {
      CombatStateChanged: ([snapshot]) =>
        onCombatStateChanged?.(toFight(snapshot as CombatSnapshotWire, [])),
    });
  }

  /**
   * Joins the fight's group and returns its state with the whole log. Calling it again
   * resynchronizes; the server first passes the turns whose deadline is over.
   */
  async joinCombat(combatId: string): Promise<FightResponse> {
    const ack = await this.hub.invoke<CombatCommandResultWire>("JoinCombat", {
      combatId,
    });
    const snapshot = accept(ack);
    return toFight(snapshot, snapshot.log);
  }

  /** The active hero acts; the answer carries only the events of this action. */
  async submitAction(
    combatId: string,
    action: FightActionRequest,
  ): Promise<FightResponse> {
    const ack =
      action.type === "Pass"
        ? await this.hub.invoke<CombatCommandResultWire>("PassTurn", {
            commandId: action.commandId,
            combatId,
            actorId: action.actorId,
          })
        : await this.hub.invoke<CombatCommandResultWire>("SubmitAction", {
            commandId: action.commandId,
            combatId,
            actorId: action.actorId,
            type: action.type.toLowerCase(),
            targetId: action.targetId ?? null,
            abilityCode: action.abilityId ?? null,
          });
    return toFight(accept(ack), ack.events);
  }

  disconnect(): Promise<void> {
    return this.hub.disconnect();
  }
}

export function combatHubUrl(gatewayUrl: string): string {
  return signalRHubUrl(gatewayUrl, "/hubs/combats");
}

function accept(ack: CombatCommandResultWire): CombatSnapshotWire {
  if (!ack.accepted || !ack.snapshot) {
    throw new CombatHubError(
      ack.error?.message ?? "The combat command was rejected.",
      ack.error?.code ?? "internal",
    );
  }
  return ack.snapshot;
}

/** Wire snapshot -> screen model. `events`: the whole log on join, the action's on a command. */
export function toFight(
  snapshot: CombatSnapshotWire,
  events: CombatEventWire[],
): FightResponse {
  const fighters = snapshot.fighters.map(toCombatant);
  return {
    fightId: snapshot.id,
    dungeonRunId: snapshot.runId,
    encounterId: snapshot.encounterId,
    status: statusOf(snapshot),
    encounter: snapshot.trigger === "boss" ? "Boss" : "Ordinary",
    floor: snapshot.floor,
    round: snapshot.turn?.round ?? 0,
    turn: snapshot.turn?.number ?? 0,
    activeCombatantId: snapshot.turn?.actorId ?? null,
    canFlee: snapshot.canFlee,
    upcomingTurns: snapshot.upcomingTurns,
    heroes: fighters.filter((fighter) => fighter.side === "Hero"),
    monsters: fighters.filter((fighter) => fighter.side === "Monster"),
    events: events.map(toEvent),
    deadlineUtc: snapshot.turn?.deadlineUtc ?? null,
    timeMaxSeconds: snapshot.turn?.timeMaxSeconds ?? 0,
  };
}

function statusOf(snapshot: CombatSnapshotWire): FightStatus {
  if (snapshot.status === "active") return "Active";
  switch (snapshot.result) {
    case "victory":
      return "Victory";
    case "fled":
      return "Fled";
    default:
      return "Defeat";
  }
}

function toCombatant(fighter: CombatFighterWire): Combatant {
  const isHero = fighter.side === "hero";
  const appearance: HeroAppearance | null = fighter.visual.appearance
    ? {
        skinTone: fighter.visual.appearance.skinTone,
        // Codes from Player; HeroSprite resolves an unknown one to its default.
        hairStyle: fighter.visual.appearance.hairStyle as HeroHairStyle,
        hairColor: fighter.visual.appearance.hairColor,
      }
    : null;
  return {
    combatantId: fighter.id,
    side: isHero ? "Hero" : "Monster",
    externalId: fighter.externalId,
    name: fighter.name,
    level: fighter.level,
    spriteKey: isHero ? "hero" : (fighter.visual.spriteKey ?? "unknown"),
    hp: fighter.currentHp,
    maxHp: fighter.maxHp,
    mana: fighter.currentMana,
    maxMana: fighter.maxMana,
    attack: fighter.attack,
    defense: fighter.defense,
    speed: fighter.speed,
    isDefending: fighter.isDefending,
    isKnockedOut: fighter.state === "outOfCombat",
    abilities: fighter.abilities.map((ability) => ({
      abilityId: ability.code,
      name: ability.name,
      manaCost: ability.manaCost,
      target: ability.targetType,
    })),
    items: [],
    visual: {
      kind: fighter.visual.kind,
      classCode: fighter.visual.classCode,
      appearance,
      spriteKey: fighter.visual.spriteKey,
      isBoss: fighter.visual.isBoss,
    },
  };
}

function toEvent(event: CombatEventWire): FightEvent {
  return {
    sequence: event.sequence,
    turn: event.turn,
    type: (event.type.charAt(0).toUpperCase() + event.type.slice(1)) as FightEventType,
    actorId: event.actorId,
    targetId: event.targetId,
    amount: event.amount,
    label: event.label,
    isCritical: event.isCritical,
  };
}
