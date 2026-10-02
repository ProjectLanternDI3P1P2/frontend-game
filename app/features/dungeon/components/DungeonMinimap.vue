<script setup lang="ts">
/**
 * Room-level map of the floor. Visited rooms are drawn in full; the rooms they
 * open onto appear as unexplored outlines, so the player always knows where
 * the next doors lead. Unknown rooms stay hidden.
 */
import { computed } from "vue";
import type { DungeonRoom } from "../types";

const props = defineProps<{
  rooms: readonly DungeonRoom[];
  visitedRoomIds: readonly number[];
  currentRoomId: number | null;
}>();

const minX = computed(() => Math.min(...props.rooms.map((room) => room.gridX)));
const minY = computed(() => Math.min(...props.rooms.map((room) => room.gridY)));
const columns = computed(() => Math.max(...props.rooms.map((room) => room.gridX)) - minX.value + 1);
const rows = computed(() => Math.max(...props.rooms.map((room) => room.gridY)) - minY.value + 1);

const visited = computed(() => new Set(props.visitedRoomIds));

const knownRooms = computed(() => {
  const known = new Set(visited.value);
  for (const id of visited.value) {
    for (const next of props.rooms[id]!.connectedRoomIds) known.add(next);
  }
  return props.rooms
    .filter((room) => known.has(room.id))
    .map((room) => ({ room, state: roomState(room.id) }));
});

function roomState(id: number): "current" | "visited" | "unexplored" {
  if (id === props.currentRoomId) return "current";
  return visited.value.has(id) ? "visited" : "unexplored";
}

/** One bar per known door, drawn between the two room cells. */
const corridors = computed(() => {
  const bars: { key: string; column: number; row: number; horizontal: boolean }[] = [];
  for (const id of visited.value) {
    const room = props.rooms[id]!;
    for (const nextId of room.connectedRoomIds) {
      const next = props.rooms[nextId]!;
      if (visited.value.has(nextId) && nextId < id) continue; // drawn once
      bars.push({
        key: `${Math.min(id, nextId)}-${Math.max(id, nextId)}`,
        column: Math.min(room.gridX, next.gridX) - minX.value,
        row: Math.min(room.gridY, next.gridY) - minY.value,
        horizontal: room.gridY === next.gridY,
      });
    }
  }
  return bars;
});

const label = computed(
  () => `Map: ${props.visitedRoomIds.length} of ${props.rooms.length} rooms explored.`,
);
</script>

<template>
  <div class="dungeon-minimap" :style="`--columns:${columns};--rows:${rows}`">
    <span class="visually-hidden">{{ label }}</span>
    <span
      v-for="bar in corridors"
      :key="bar.key"
      :class="[
        'dungeon-minimap__corridor',
        bar.horizontal
          ? 'dungeon-minimap__corridor--horizontal'
          : 'dungeon-minimap__corridor--vertical',
      ]"
      :style="`--column:${bar.column};--row:${bar.row}`"
      aria-hidden="true"
    />
    <span
      v-for="{ room, state } in knownRooms"
      :key="room.id"
      :class="[
        'dungeon-minimap__room',
        `dungeon-minimap__room--${state}`,
        state !== 'unexplored' ? `dungeon-minimap__room--${room.type}` : null,
      ]"
      :style="`--column:${room.gridX - minX};--row:${room.gridY - minY}`"
      aria-hidden="true"
    />
  </div>
</template>

<style scoped lang="scss">
.dungeon-minimap {
  --cell: 1rem;
  --gap: 0.375rem;
  --step: calc(var(--cell) + var(--gap));

  position: relative;
  inline-size: calc(var(--columns) * var(--step) - var(--gap));
  block-size: calc(var(--rows) * var(--step) - var(--gap));

  &__room,
  &__corridor {
    position: absolute;
    left: calc(var(--column) * var(--step));
    top: calc(var(--row) * var(--step));
  }

  &__room {
    inline-size: var(--cell);
    block-size: var(--cell);
    border-radius: var(--radius-sm);

    &--unexplored {
      border: 1px dashed var(--color-border-strong);
    }

    &--visited {
      background-color: var(--color-surface-overlay);
      border: 1px solid var(--color-border-strong);
    }

    &--current {
      background-color: var(--color-accent);
      box-shadow: 0 0 0 2px var(--color-surface-base), 0 0 0 3px var(--color-accent);
    }

    &--visited.dungeon-minimap__room--treasure {
      border-color: var(--color-accent);
    }

    &--visited.dungeon-minimap__room--boss {
      border-color: var(--color-danger);
      background-color: var(--color-danger-strong);
    }
  }

  &__corridor {
    background-color: var(--color-border-strong);

    &--horizontal {
      margin-left: var(--cell);
      margin-top: calc(var(--cell) / 2 - 1px);
      inline-size: var(--gap);
      block-size: 2px;
    }

    &--vertical {
      margin-top: var(--cell);
      margin-left: calc(var(--cell) / 2 - 1px);
      inline-size: 2px;
      block-size: var(--gap);
    }
  }
}
</style>
