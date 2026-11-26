<script lang="ts" setup>
import { computed } from "vue";
import { Knob } from "@/registry/primitives/knob/vue";

/** A graduation around the dial: a value, or a value and its label. */
export type KnobMark = number | { label?: string; value: number };

const props = withDefaults(
  defineProps<{
    /** Prints the value in the readout and in what screen readers announce, e.g. as `"8.7 kHz"`. */
    formatValue?: (value: number) => string;
    /** Graduations drawn around the dial, on its scale. */
    marks?: readonly KnobMark[];
    size?: "xs" | "sm" | "default" | "lg" | "xl";
    /** When the value shows under the dial: while hovered, turned or focused (`auto`), `always`, or `hidden`. */
    valueLabel?: "always" | "auto" | "hidden";
  }>(),
  { size: "default", valueLabel: "auto" }
);

defineOptions({ inheritAttrs: false });

// The knob's options go to its root, its name to the thumb's input.
const forRoot = ({
  "aria-describedby": _describedBy,
  "aria-label": _label,
  "aria-labelledby": _labelledBy,
  ...rest
}: Record<string, unknown>) => rest;

const markValue = (mark: KnobMark) =>
  typeof mark === "number" ? mark : mark.value;
const markLabel = (mark: KnobMark) =>
  typeof mark === "number" ? undefined : mark.label;

/** What the scale holds, for the parts to leave it room: labels, ticks alone, or nothing. */
const scale = computed(() => {
  if (!props.marks) {
    return;
  }
  return props.marks.some((mark) => markLabel(mark) !== undefined)
    ? "labels"
    : "ticks";
});

const ariaValueText = computed(() => {
  const format = props.formatValue;
  return format
    ? (_formatted: string, value: number) => format(value)
    : undefined;
});
</script>

<template>
  <Knob.Root
    v-bind="forRoot($attrs)"
    :data-marks="scale"
    :data-readout="valueLabel === 'hidden' ? undefined : valueLabel"
    :data-size="size"
  >
    <Knob.Control>
      <div data-slot="knob-body" />
      <Knob.Track />
      <Knob.Indicator />
      <Knob.Thumb
        :aria-describedby="$attrs['aria-describedby']"
        :aria-label="$attrs['aria-label']"
        :aria-labelledby="$attrs['aria-labelledby']"
        :get-aria-value-text="ariaValueText"
      >
        <svg aria-hidden="true" data-slot="knob-needle" viewBox="0 0 48 48">
          <line
            stroke="currentColor"
            stroke-linecap="round"
            stroke-width="2.75"
            x1="24"
            x2="24"
            y1="11.53"
            y2="18.84"
          />
        </svg>
      </Knob.Thumb>
    </Knob.Control>
    <Knob.Mark
      v-for="mark in marks ?? []"
      :key="markValue(mark)"
      :value="markValue(mark)"
    >
      <span data-slot="knob-mark-tick" />
      <span data-slot="knob-mark-label" v-if="markLabel(mark) !== undefined">{{
        markLabel(mark)
      }}</span>
    </Knob.Mark>
    <Knob.Value v-if="valueLabel !== 'hidden'">
      <template #default="{ state }">{{
        formatValue ? formatValue(state.value) : state.formatted
      }}</template>
    </Knob.Value>
  </Knob.Root>
</template>
