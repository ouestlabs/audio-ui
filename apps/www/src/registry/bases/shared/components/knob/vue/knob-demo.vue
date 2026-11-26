<script lang="ts" setup>
import Knob from "@/registry/bases/shared/audio-ui/elements/vue/Knob.vue";

const marks = [
  { label: "0", value: 0 },
  25,
  50,
  75,
  { label: "100", value: 100 },
];
</script>

<template>
  <Knob
    aria-label="Level"
    size="lg"
    :default-value="50"
    :marks="marks"
    :max="100"
    :min="0"
    :step="1"
  />
</template>
