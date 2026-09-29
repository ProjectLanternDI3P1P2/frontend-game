<script lang="ts">
export enum AvatarSize {
  SM = "sm",
  MD = "md",
  LG = "lg",
}

export enum AvatarStatus {
  ONLINE = "online",
  OFFLINE = "offline",
  AWAY = "away",
}
</script>

<script setup lang="ts">
withDefaults(
  defineProps<{
    src?: string;
    alt?: string;
    name: string;
    size?: AvatarSize;
    status?: AvatarStatus;
  }>(),
  {
    src: "",
    alt: "",
    size: AvatarSize.MD,
    status: AvatarStatus.OFFLINE,
  },
);

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
</script>

<template>
  <span
    class="ui-avatar"
    :class="['ui-avatar--' + size, { 'ui-avatar--image': src }]"
    :title="name"
  >
    <img v-if="src" :src="src" :alt="alt || name" />
    <span v-else aria-hidden="true">{{ initials(name) }}</span>
    <span
      v-if="status"
      class="ui-avatar__status"
      :class="'ui-avatar__status--' + status"
      ><span class="visually-hidden">{{ status }}</span></span
    >
  </span>
</template>

<style scoped lang="scss">
.ui-avatar {
  position: relative;
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 2.5rem;
  height: 2.5rem;
  overflow: hidden;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-pill);
  background-color: var(--color-arcane);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}
.ui-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  image-rendering: pixelated;
}
.ui-avatar--sm {
  width: 1.75rem;
  height: 1.75rem;
  font-size: var(--font-size-xs);
}
.ui-avatar--lg {
  width: 4rem;
  height: 4rem;
  font-size: var(--font-size-lg);
}
.ui-avatar__status {
  position: absolute;
  right: 0;
  bottom: 0;
  width: var(--space-3);
  height: var(--space-3);
  border: 2px solid var(--color-surface-raised);
  border-radius: var(--radius-pill);
  background-color: var(--color-text-muted);
}
.ui-avatar__status--online {
  background-color: var(--color-success);
}
.ui-avatar__status--away {
  background-color: var(--color-accent);
}
</style>
