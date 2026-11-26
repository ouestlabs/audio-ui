<script lang="ts" setup>
import { onBeforeUnmount, onMounted } from "vue";
import Meter from "@/registry/bases/shared/audio-ui/elements/vue/Meter.vue";
import { createSimulatedLevels } from "@/registry/lib/devices/simulated-levels";

// The marks of a dBFS scale, down to the floor.
const scale = [6, 0, -6, -12, -20, -30, -40, -60];

const simulated = createSimulatedLevels(2);
let stop: (() => void) | undefined;
onMounted(() => {
  stop = simulated.run();
});
onBeforeUnmount(() => stop?.());
</script>

<template>
  <Meter
    aria-label="Stereo output"
    :marks="scale"
    :source="simulated.source"
    :warn-threshold="-12"
  />
</template>
