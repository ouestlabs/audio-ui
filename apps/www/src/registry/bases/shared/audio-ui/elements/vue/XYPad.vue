<script lang="ts" setup>
import { XYPad } from "@/registry/primitives/xypad/vue";

withDefaults(
  defineProps<{
    /** Takes the height left in a column in place of its size's, down to a strip: in a short panel it gives way to the controls under it. */
    fill?: boolean;
    /** Prints the value in the display, e.g. as `"440 Hz · 70 %"`. */
    formatValue?: (value: { x: number; y: number }) => string;
    size?: "sm" | "default" | "lg" | "xl";
    valueDisplay?: "visible" | "hidden";
  }>(),
  { fill: false, size: "default", valueDisplay: "visible" }
);

defineOptions({ inheritAttrs: false });

// The pad's options go to its root, its name to the thumb's inputs.
const forRoot = ({
  "aria-describedby": _describedBy,
  "aria-label": _label,
  "aria-labelledby": _labelledBy,
  ...rest
}: Record<string, unknown>) => rest;

const LINES = [20, 40, 60, 80];
</script>

<template>
  <XYPad.Root
    v-bind="forRoot($attrs)"
    :data-fill="fill ? '' : undefined"
    :data-size="size"
  >
    <XYPad.Control>
      <div aria-hidden="true" data-slot="xypad-grid">
        <div
          data-orientation="vertical"
          data-slot="xypad-grid-line"
          v-for="position in LINES"
          :key="`vertical-${position}`"
          :style="{ left: `${position}%` }"
        />
        <div
          data-orientation="horizontal"
          data-slot="xypad-grid-line"
          v-for="position in LINES"
          :key="`horizontal-${position}`"
          :style="{ top: `${position}%` }"
        />
      </div>
      <div
        aria-hidden="true"
        data-orientation="vertical"
        data-slot="xypad-crosshair"
      />
      <div
        aria-hidden="true"
        data-orientation="horizontal"
        data-slot="xypad-crosshair"
      />
      <XYPad.Thumb
        :aria-describedby="$attrs['aria-describedby']"
        :aria-label="$attrs['aria-label']"
        :aria-labelledby="$attrs['aria-labelledby']"
      >
        <div data-slot="xypad-cursor-glow" />
        <div data-slot="xypad-cursor-dot" />
        <div data-slot="xypad-cursor-highlight" />
      </XYPad.Thumb>
      <XYPad.Value v-if="valueDisplay === 'visible'">
        <template v-if="formatValue" #default="{ state }">{{
          formatValue(state.value)
        }}</template>
      </XYPad.Value>
    </XYPad.Control>
  </XYPad.Root>
</template>
