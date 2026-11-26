<script lang="ts">
import type { ComponentProps } from "svelte";
import { Knob } from "@/registry/primitives/knob/svelte/index";

/** A graduation around the dial: a value, or a value and its label. */
type KnobMark = number | { label?: string; value: number };

let {
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  formatValue,
  marks,
  size = "default",
  valueLabel = "auto",
  ...rest
}: Omit<ComponentProps<typeof Knob.Root>, "children"> & {
  "aria-describedby"?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /** Prints the value in the readout and in what screen readers announce, e.g. as `"8.7 kHz"`. */
  formatValue?: (value: number) => string;
  /** Graduations drawn around the dial, on its scale. */
  marks?: readonly KnobMark[];
  size?: "xs" | "sm" | "default" | "lg" | "xl";
  /** When the value shows under the dial: while hovered, turned or focused (`auto`), `always`, or `hidden`. */
  valueLabel?: "always" | "auto" | "hidden";
} = $props();

const markValue = (mark: KnobMark) =>
  typeof mark === "number" ? mark : mark.value;
const markLabel = (mark: KnobMark) =>
  typeof mark === "number" ? undefined : mark.label;

/** What the scale holds, for the parts to leave it room: labels, ticks alone, or nothing. */
const scale = $derived.by(() => {
  if (!marks) {
    return;
  }
  return marks.some((mark) => markLabel(mark) !== undefined)
    ? "labels"
    : "ticks";
});

const ariaValueText = $derived(
  formatValue
    ? (_formatted: string, value: number) => formatValue(value)
    : undefined
);
</script>

<Knob.Root
  {...rest}
  data-marks={scale}
  data-readout={valueLabel === "hidden" ? undefined : valueLabel}
  data-size={size}
>
  <Knob.Control>
    <div data-slot="knob-body"></div>
    <Knob.Track />
    <Knob.Indicator />
    <Knob.Thumb
      aria-describedby={describedBy}
      aria-label={label}
      aria-labelledby={labelledBy}
      getAriaValueText={ariaValueText}
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
  {#each marks ?? [] as mark (markValue(mark))}
    <Knob.Mark value={markValue(mark)}>
      <span data-slot="knob-mark-tick"></span>
      {#if markLabel(mark) !== undefined}
        <span data-slot="knob-mark-label">{markLabel(mark)}</span>
      {/if}
    </Knob.Mark>
  {/each}
  {#if valueLabel !== "hidden"}
    <Knob.Value>
      {#snippet children(
        state
      )}
        {formatValue ? formatValue(state.value) : state.formatted}
      {/snippet}
    </Knob.Value>
  {/if}
</Knob.Root>
