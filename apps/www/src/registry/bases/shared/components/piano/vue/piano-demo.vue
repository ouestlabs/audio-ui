<script lang="ts" setup>
import { Piano } from "@/registry/primitives/piano/vue";
</script>

<template>
  <Piano.Root
    aria-label="Piano"
    class="cn-piano cn-piano-size-default w-full touch-none select-none overflow-hidden data-disabled:pointer-events-none data-disabled:opacity-50"
    :max-pitch="72"
    :min-pitch="48"
  >
    <template #default="{ state }">
      <Piano.Key
        class="cn-piano-key cursor-pointer"
        v-for="pitch in state.pitches"
        :key="pitch"
        :pitch="pitch"
      />
    </template>
  </Piano.Root>
</template>
