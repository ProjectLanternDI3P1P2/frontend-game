<script setup lang="ts">
/**
 * US-PLAYER-06 — public player profile, server-rendered with `swr: 60`
 * (docs/rendering-modes.md): the profile is in the HTML, for crawlers and
 * first-time visitors. `ref` is a player id (GUID) or a public handle. An
 * unknown, deleted or anonymised player answers a real HTTP 404
 * (« Player not found », app/error.vue). No identity is involved.
 */
import { computed } from "vue";
import PublicProfileView from "~/features/player/components/PublicProfileView.vue";
import { usePublicProfile } from "~/features/player/composables/usePublicProfile";
import {
  buildProfileCanonicalUrl,
  describePublicProfile,
  publicProfileTitle,
} from "~/features/player/publicProfileRules";

definePageMeta({ layout: "default" });

const route = useRoute();
const config = useRuntimeConfig();
const param = route.params.ref;
const profileRef = Array.isArray(param) ? (param[0] ?? "") : String(param ?? "");

const { state, refreshing, retry } = await usePublicProfile(profileRef);

const profile = computed(() => state.value.profile);
const title = computed(() =>
  profile.value ? publicProfileTitle(profile.value.displayName) : "Player profile",
);
const description = computed(() =>
  profile.value
    ? describePublicProfile(profile.value)
    : "Public player profile on Project Lantern.",
);
const canonicalUrl = computed(() =>
  profile.value
    ? buildProfileCanonicalUrl(config.public.siteUrl, profile.value.publicHandle)
    : null,
);

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogType: "profile",
  ogUrl: computed(() => canonicalUrl.value ?? undefined),
});

// Replaces app.vue's site-wide canonical (unhead keeps one `canonical` link).
useHead({
  link: computed(() =>
    canonicalUrl.value ? [{ rel: "canonical" as const, href: canonicalUrl.value }] : [],
  ),
});
</script>

<template>
  <PublicProfileView :state="state" :refreshing="refreshing" @retry="retry" />
</template>
