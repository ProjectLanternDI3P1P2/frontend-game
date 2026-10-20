/**
 * Sizes the view to the element that holds the board: the dungeon fills the
 * screen whatever its size, and follows it when the window is resized.
 */
import type { Ref } from "vue";
import { onBeforeUnmount, ref, watch } from "vue";
import { fitViewport } from "../dungeonRules";

export function useBoardViewport(board: Ref<HTMLElement | null>) {
  const viewport = ref(fitViewport(window.innerWidth, window.innerHeight));
  let observer: ResizeObserver | null = null;

  const fit = (element: HTMLElement) => {
    const next = fitViewport(element.clientWidth, element.clientHeight);
    const current = viewport.value;
    if (next.tile !== current.tile || next.columns !== current.columns || next.rows !== current.rows) {
      viewport.value = next;
    }
  };

  // The board only exists once the run is loaded.
  watch(
    board,
    (element) => {
      observer?.disconnect();
      observer = null;
      if (!element) return;
      fit(element);
      observer = new ResizeObserver(() => fit(element));
      observer.observe(element);
    },
    { immediate: true },
  );

  onBeforeUnmount(() => observer?.disconnect());

  return viewport;
}
