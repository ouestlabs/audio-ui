<script lang="ts" setup>
import { onBeforeUnmount, onMounted } from "vue";
import { createSource } from "@/registry/primitives/primitive";
import { Waveform } from "@/registry/primitives/waveform/vue";

/** A voice made up from a few slow waves: no microphone, no sound. */
function voiceAt(seconds: number) {
  const syllable = Math.max(0, Math.sin(seconds * 5.3)) ** 2;
  const breath = 0.55 + 0.45 * Math.sin(seconds * 0.9);
  return [Math.min(1, syllable * breath + 0.05)];
}

const level = createSource<ArrayLike<number>>([0]);

let frame = 0;
const tick = (now: number) => {
  level.set(voiceAt(now / 1000));
  frame = requestAnimationFrame(tick);
};
onMounted(() => {
  frame = requestAnimationFrame(tick);
});
onBeforeUnmount(() => cancelAnimationFrame(frame));
</script>

<!-- The waveform's root drawn as a live waveform: its sheet reads `data-variant`. -->
<template>
  <Waveform.Root
    aria-label="Voice"
    data-variant="live"
    role="img"
    :levels="level"
  >
    <Waveform.Canvas mode="scrolling" />
  </Waveform.Root>
</template>
