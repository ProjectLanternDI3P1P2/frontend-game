/**
 * The stage of the fight: where each fighter stands, what pose it holds, and the effects
 * playing over the board. `useCombat` drives it beat by beat; the components only draw it.
 *
 * Nothing here decides an outcome: the service did. The stage only shows it.
 */
import { ref } from "vue";
import { useMotionPreference } from "./useMotionPreference";

/** The pose of a fighter. */
export type Stance =
  | "idle"
  /** Running to a target or back to its place. */
  | "run"
  /** Striking with its weapon, biting, ramming. */
  | "strike"
  /** Casting a spell or drinking. */
  | "cast"
  | "hurt"
  /** Sidestepping a blow. */
  | "dodge"
  | "guard"
  | "down"
  | "cheer";

/** Where a fighter stands instead of its own slot: next to a combatant, or off-screen. */
export type Placement = { near: string } | { offScreen: true };

export type EffectKind =
  /** Sword arc over the target. */
  | "slash"
  /** Claw marks of a monster. */
  | "claw"
  /** Star of an impact. */
  | "impact"
  /** Flies from the source to the target. */
  | "fireball"
  | "explosion"
  /** Ring of ice over a target. */
  | "frost"
  | "heal"
  | "mana"
  | "shield"
  | "potion"
  /** Magic circle under a caster. */
  | "aura"
  /** Smoke of a knock-out. */
  | "smoke"
  /** Burst of rays of a critical hit. */
  | "critical"
  /** A ring that bends the light around a heavy blow. */
  | "shockwave";

export interface StageEffect {
  key: number;
  kind: EffectKind;
  targetId: string;
  /** For effects that travel: where they come from. */
  sourceId?: string;
  /** Milliseconds; the effect is removed after it. */
  duration: number;
}

/** A number popping over a fighter: damage, heal or mana. */
export interface FloatingText {
  key: number;
  combatantId: string;
  text: string;
  kind: "damage" | "heavy" | "crit" | "miss" | "heal" | "mana";
}

/** Durations of the choreography, in milliseconds. */
export const TIMING = {
  run: 360,
  windUp: 120,
  strike: 300,
  react: 260,
  projectile: 420,
  cast: 380,
  knockOut: 650,
  pause: 160,
  /** The freeze of a critical hit, before the target reacts. */
  hitStop: 110,
} as const;

export function useBattleStage() {
  const { reduced } = useMotionPreference();
  /** With reduced motion, the beats are kept but much shorter. */
  const factor = () => (reduced.value ? 0.25 : 1);

  const stances = ref<Record<string, Stance>>({});
  const placements = ref<Record<string, Placement>>({});
  /** Fighters drawn mirrored: heroes running back, the party fleeing. */
  const turnedBack = ref<string[]>([]);
  const effects = ref<StageEffect[]>([]);
  const floating = ref<FloatingText[]>([]);
  /** Changes on every heavy hit: the board shakes. */
  const shake = ref(0);
  /** The camera punches in on a combatant for a critical hit. */
  const punch = ref<{ key: number; targetId: string } | null>(null);
  /** Changes when the party takes a heavy blow: the screen flashes red. */
  const flash = ref(0);

  let key = 0;

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms * factor()));
  }

  function pose(id: string | null, stance: Stance): void {
    if (!id) return;
    stances.value = { ...stances.value, [id]: stance };
  }

  /** Back to idle, except the fighters who are down. */
  function rest(id: string | null): void {
    if (!id || stances.value[id] === "down") return;
    pose(id, "idle");
  }

  function place(id: string, placement: Placement | null): void {
    const others = Object.entries(placements.value).filter(([other]) => other !== id);
    placements.value = Object.fromEntries(placement ? [...others, [id, placement]] : others);
  }

  function face(id: string, back: boolean): void {
    const others = turnedBack.value.filter((other) => other !== id);
    turnedBack.value = back ? [...others, id] : others;
  }

  function play(kind: EffectKind, targetId: string | null, duration: number, sourceId?: string) {
    if (!targetId) return;
    const effect: StageEffect = { key: ++key, kind, targetId, sourceId, duration: duration * factor() };
    effects.value = [...effects.value, effect];
    setTimeout(
      () => (effects.value = effects.value.filter((other) => other.key !== effect.key)),
      effect.duration,
    );
  }

  function pop(combatantId: string | null, text: string, kind: FloatingText["kind"]): void {
    if (!combatantId) return;
    const entry = { key: ++key, combatantId, text, kind };
    floating.value = [...floating.value, entry];
    setTimeout(() => (floating.value = floating.value.filter((f) => f.key !== entry.key)), 1100);
  }

  function shakeBoard(): void {
    shake.value++;
  }

  function punchIn(targetId: string | null): void {
    if (targetId) punch.value = { key: ++key, targetId };
  }

  function flashScreen(): void {
    flash.value++;
  }

  /** Clears the stage, keeping the fighters who are down on the floor. */
  function reset(downIds: readonly string[]): void {
    stances.value = Object.fromEntries(downIds.map((id) => [id, "down" as Stance]));
    placements.value = {};
    turnedBack.value = [];
  }

  return {
    stances,
    placements,
    turnedBack,
    effects,
    floating,
    shake,
    punch,
    flash,
    wait,
    pose,
    rest,
    place,
    face,
    play,
    pop,
    shakeBoard,
    punchIn,
    flashScreen,
    reset,
  };
}

export type BattleStage = ReturnType<typeof useBattleStage>;
