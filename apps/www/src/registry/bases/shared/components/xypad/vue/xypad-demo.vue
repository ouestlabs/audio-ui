<script lang="ts" setup>
import XYPad from "@/registry/bases/shared/audio-ui/elements/vue/XYPad.vue";
</script>

<template>
  <XYPad
    aria-label="Position"
    style="width: 12rem"
    :default-value="{ x: 50, y: 50 }"
    :max-x="100"
    :max-y="100"
    :min-x="0"
    :min-y="0"
  />
</template>
