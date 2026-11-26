<script lang="ts" setup>
import { computed } from "vue";
import { Fader } from "@/registry/primitives/fader/vue";

/** A graduation on the fader's scale: a value, or a value and its label. */
export type FaderMark = number | { label?: string; value: number };

const props = withDefaults(
  defineProps<{
    /** Lets you type the value: a double click on the readout, or Enter while it has focus. */
    editableValue?: boolean;
    /** Prints the value in the readout and in what screen readers announce, e.g. as `"-6 dB"`. */
    formatValue?: (value: number) => string;
    /** Graduations drawn beside the track: a ruler for the value. */
    marks?: readonly FaderMark[];
    orientation?: "horizontal" | "vertical";
    size?: "sm" | "default" | "lg";
    /** How many grip lines the thumb carries, or `false` for none. */
    thumbMarks?: number | false;
    /** When the value shows beside the thumb: while hovered, dragged or focused (`auto`), `always`, or `hidden`. */
    valueLabel?: "always" | "auto" | "hidden";
  }>(),
  {
    orientation: "vertical",
    size: "default",
    thumbMarks: 3,
    valueLabel: "auto",
  }
);

defineOptions({ inheritAttrs: false });

// The fader's options go to its root, its name to the thumb's input.
const forRoot = ({
  "aria-describedby": _describedBy,
  "aria-label": _label,
  "aria-labelledby": _labelledBy,
  ...rest
}: Record<string, unknown>) => rest;

const markValue = (mark: FaderMark) =>
  typeof mark === "number" ? mark : mark.value;
const markLabel = (mark: FaderMark) =>
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

const grips = computed(() =>
  props.thumbMarks === false ? 0 : props.thumbMarks
);

const ariaValueText = computed(() => {
  const format = props.formatValue;
  return format
    ? (_formatted: string, value: number) => format(value)
    : undefined;
});
</script>

<template>
  <Fader.Root
    v-bind="forRoot($attrs)"
    :data-marks="scale"
    :data-readout="valueLabel === 'hidden' ? undefined : valueLabel"
    :data-size="size"
    :orientation="orientation"
  >
    <Fader.Control>
      <Fader.Track>
        <Fader.Indicator />
      </Fader.Track>
      <div aria-hidden="true" data-slot="fader-scale" v-if="marks">
        <Fader.Mark
          v-for="mark in marks"
          :key="markValue(mark)"
          :value="markValue(mark)"
        >
          <span data-slot="fader-mark-tick" />
          <span
            data-slot="fader-mark-label"
            v-if="markLabel(mark) !== undefined"
            >{{
              markLabel(mark)
            }}</span
          >
        </Fader.Mark>
      </div>
      <Fader.Thumb
        :aria-describedby="$attrs['aria-describedby']"
        :aria-label="$attrs['aria-label']"
        :aria-labelledby="$attrs['aria-labelledby']"
        :get-aria-value-text="ariaValueText"
      >
        <div data-slot="fader-thumb-inner" :data-orientation="orientation">
          <div
            data-slot="fader-thumb-mark"
            v-for="grip in grips"
            :key="grip"
            :data-orientation="orientation"
          />
        </div>
        <Fader.Value v-if="valueLabel !== 'hidden'" :editable="editableValue">
          <template #default="{ state }">{{
            formatValue ? formatValue(state.value) : state.formatted
          }}</template>
        </Fader.Value>
      </Fader.Thumb>
    </Fader.Control>
  </Fader.Root>
</template>
