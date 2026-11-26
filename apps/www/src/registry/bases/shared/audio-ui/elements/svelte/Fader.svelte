<script lang="ts">
import type { ComponentProps } from "svelte";
import { Fader } from "@/registry/primitives/fader/svelte/index";

/** A graduation on the fader's scale: a value, or a value and its label. */
type FaderMark = number | { label?: string; value: number };

let {
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  formatValue,
  marks,
  orientation = "vertical",
  size = "default",
  thumbMarks = 3,
  valueLabel = "auto",
  ...rest
}: Omit<ComponentProps<typeof Fader.Root>, "children"> & {
  "aria-describedby"?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
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
} = $props();

const markValue = (mark: FaderMark) =>
  typeof mark === "number" ? mark : mark.value;
const markLabel = (mark: FaderMark) =>
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

const grips = $derived(
  Array.from({ length: thumbMarks === false ? 0 : thumbMarks }, (_, i) => i)
);

const ariaValueText = $derived(
  formatValue
    ? (_formatted: string, value: number) => formatValue(value)
    : undefined
);
</script>

<Fader.Root
  {...rest}
  data-marks={scale}
  data-readout={valueLabel === "hidden" ? undefined : valueLabel}
  data-size={size}
  {orientation}
>
  <Fader.Control>
    <Fader.Track>
      <Fader.Indicator />
    </Fader.Track>
    {#if marks}
      <div aria-hidden="true" data-slot="fader-scale">
        {#each marks as mark (markValue(mark))}
          <Fader.Mark value={markValue(mark)}>
            <span data-slot="fader-mark-tick"></span>
            {#if markLabel(mark) !== undefined}
              <span data-slot="fader-mark-label">{markLabel(mark)}</span>
            {/if}
          </Fader.Mark>
        {/each}
      </div>
    {/if}
    <Fader.Thumb
      aria-describedby={describedBy}
      aria-label={label}
      aria-labelledby={labelledBy}
      getAriaValueText={ariaValueText}
    >
      <div data-orientation={orientation} data-slot="fader-thumb-inner">
        {#each grips as grip (grip)}
          <div
            data-orientation={orientation}
            data-slot="fader-thumb-mark"
          ></div>
        {/each}
      </div>
      {#if valueLabel !== "hidden"}
        <Fader.Value>
          {#snippet children(
            state
          )}
            {formatValue ? formatValue(state.value) : state.formatted}
          {/snippet}
        </Fader.Value>
      {/if}
    </Fader.Thumb>
  </Fader.Control>
</Fader.Root>
