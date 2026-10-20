<script setup lang="ts">
import { computed, ref } from "vue";
import { ButtonType, NoticeTone, PanelHeadingLevel } from "~/shared/ui/ui.types";
useHead({ title: "Forms · UI kit" });
const heroName = ref("Mira the Scout");
const className = ref("");
const agreed = ref(false);
const notifications = ref(true);
const submitted = ref(false);
const classOptions = [
  { label: "Warrior", value: "warrior" },
  { label: "Mage", value: "mage" },
  { label: "Scout", value: "scout" },
];
const classError = computed(() =>
  submitted.value && !className.value ? "Choose a class before continuing." : "",
);
const submit = () => {
  submitted.value = true;
};
</script>
<template>
  <form class="demo-page" @submit.prevent="submit">
    <header>
      <NuxtLink to="/demo">← Component library</NuxtLink>
      <h1>Forms</h1>
      <p>Every control correctly connects its label, help text, and error state.</p>
    </header>
    <UiPanel title="Create an adventurer" :heading-level="PanelHeadingLevel.TWO"
      ><div class="demo-page__form">
        <UiInput
          id="hero-name"
          v-model="heroName"
          label="Adventurer name"
          hint="This name is visible to your party."
          required
          ><template #prefix>✦</template></UiInput
        ><UiSelect
          id="hero-class"
          v-model="className"
          :options="classOptions"
          label="Class"
          placeholder="Select a class"
          :error="classError"
          required
        /><UiCheckbox
          id="rules"
          v-model="agreed"
          label="I accept the guild code"
          hint="Required to join the season."
        /><UiSwitch
          id="notifications"
          v-model="notifications"
          label="Party notifications"
          description="Notify me when an ally forms a party."
        /><UiButton :type="ButtonType.SUBMIT">Save</UiButton>
      </div></UiPanel
    ><UiNotice
      v-if="submitted && className"
      :tone="NoticeTone.SUCCESS"
      title="Valid form"
      >{{ heroName }} joins the
      {{ classOptions.find((item) => item.value === className)?.label }}s. Guild code:
      {{ agreed ? "accepted" : "pending" }}.</UiNotice
    >
  </form>
</template>
<style scoped lang="scss">
.demo-page {
  display: grid;
  gap: var(--space-5);
}
.demo-page > header {
  display: grid;
  gap: var(--space-2);
}
.demo-page > header p {
  color: var(--color-text-muted);
}
.demo-page__form {
  display: grid;
  max-width: 36rem;
  gap: var(--space-5);
}
</style>
