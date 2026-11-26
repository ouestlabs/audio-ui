<script lang="ts" setup>
import { Meter } from "@/registry/primitives/meter/vue";

withDefaults(
  defineProps<{
    /** Levels graduated along the meter's length, such as `[-48, -24, -12, -6, 0]`, each with its label. */
    marks?: readonly number[];
    orientation?: "horizontal" | "vertical";
    peakMarks?: "visible" | "hidden";
    /** How a level maps to the meter's length: the IEC 60268-18 curve, linear in dB, or your own. */
    scale?: "iec" | "linear" | ((level: number) => number);
    size?: "sm" | "default" | "lg";
  }>(),
  {
    orientation: "vertical",
    peakMarks: "visible",
    scale: "iec",
    size: "default",
  }
);

defineOptions({ inheritAttrs: false });

// Each channel is named after the meter, and numbered when there are several.
const channelLabel = (label: unknown, index: number, count: number) => {
  if (typeof label !== "string") {
    return;
  }
  return count > 1 ? `${label} ${index + 1}` : label;
};

const decibels = (formattedValue: string) => `${formattedValue} dB`;
</script>

<template>
  <Meter.Root
    v-bind="$attrs"
    :data-marks="marks ? 'labels' : undefined"
    :data-size="size"
    :orientation="orientation"
    :scale="scale"
  >
    <template #default="{ state }">
      <Meter.Channel
        v-for="index in state.channelCount"
        :key="index"
        :aria-label="channelLabel($attrs['aria-label'], index - 1, state.channelCount)"
        :get-aria-value-text="decibels"
        :index="index - 1"
      >
        <Meter.Indicator />
        <Meter.Peak v-if="peakMarks === 'visible'" />
      </Meter.Channel>
      <Meter.Mark v-for="level in marks ?? []" :key="level" :value="level">
        <span
          aria-hidden="true"
          data-slot="meter-mark-tick"
          :data-orientation="orientation"
        />
        <span data-slot="meter-mark-label">{{ level }}</span>
      </Meter.Mark>
    </template>
  </Meter.Root>
</template>
