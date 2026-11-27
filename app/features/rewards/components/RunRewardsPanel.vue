<script setup lang="ts">
import { useId } from "vue";
import { useRunRewards } from "../composables/useRunRewards";
import RunRewardSummary from "./RunRewardSummary.vue";

const props = defineProps<{
  runId: string | null | undefined;
  heroNames: ReadonlyMap<string, string>;
}>();

const titleId = useId();
const { state, load } = useRunRewards(() => props.runId);
</script>

<template>
  <section v-if="state.status !== 'idle'" :aria-labelledby="titleId">
    <h2 :id="titleId">Group rewards</h2>
    <p v-if="state.status === 'loading'" role="status">Loading rewards…</p>
    <p v-else-if="state.status === 'unavailable'" role="alert">
      Récompenses indisponibles
    </p>
    <template v-else-if="state.status === 'participationUnavailable'">
      <p role="alert">Impossible de vérifier votre participation pour le moment.</p>
      <button type="button" @click="load">Réessayer</button>
    </template>
    <template v-else-if="state.status === 'error'">
      <p role="alert">Impossible de charger les récompenses.</p>
      <button type="button" @click="load">Réessayer</button>
    </template>
    <template v-else-if="state.status === 'success'">
      <p v-if="state.summary.distributions.length === 0">
        No group rewards for this run.
      </p>
      <RunRewardSummary v-else :summary="state.summary" :hero-names="heroNames" />
    </template>
  </section>
</template>
