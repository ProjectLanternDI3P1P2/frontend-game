/**
 * Full or reduced combat animations (ADR-FE-015).
 *
 * By default the fight follows the system's `prefers-reduced-motion`. Many machines turn
 * it on without the player knowing (Windows "Animation effects" off), and the fight then
 * plays its short version: so the player can also choose, and the choice is remembered on
 * this device. Shared by every component of the fight screen.
 */
import { ref } from "vue";

const STORAGE_KEY = "lantern:combat-motion";

const reduced = ref(initial());

function initial(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "full") return false;
    if (stored === "reduced") return true;
  } catch {
    // Storage blocked: fall back to the system preference.
  }
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function useMotionPreference() {
  function toggle(): void {
    reduced.value = !reduced.value;
    try {
      localStorage.setItem(STORAGE_KEY, reduced.value ? "reduced" : "full");
    } catch {
      // The choice still holds for this page.
    }
  }

  return { reduced, toggle };
}
