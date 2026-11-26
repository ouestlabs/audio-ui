<script lang="ts" setup>
import { Piano } from "@/registry/primitives/piano/vue";

withDefaults(defineProps<{ size?: "sm" | "default" | "lg" }>(), {
  size: "default",
});
</script>

<template>
  <Piano.Root :data-size="size">
    <template #default="{ state }">
      <Piano.Key v-for="pitch in state.pitches" :key="pitch" :pitch="pitch" />
    </template>
  </Piano.Root>
</template>
