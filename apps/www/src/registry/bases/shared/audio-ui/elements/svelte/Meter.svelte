<script lang="ts">
import type { ComponentProps } from "svelte";
import { Meter } from "@/registry/primitives/meter/svelte/index";

let {
  "aria-label": label,
  marks,
  orientation = "vertical",
  peakMarks = "visible",
  scale = "iec",
  size = "default",
  ...rest
}: Omit<ComponentProps<typeof Meter.Root>, "children"> & {
  "aria-label"?: string;
  /** Levels graduated along the meter's length, such as `[-48, -24, -12, -6, 0]`, each with its label. */
  marks?: readonly number[];
  orientation?: "horizontal" | "vertical";
  peakMarks?: "visible" | "hidden";
  /** How a level maps to the meter's length: the IEC 60268-18 curve, linear in dB, or your own. */
  scale?: "iec" | "linear" | ((level: number) => number);
  size?: "sm" | "default" | "lg";
} = $props();

const decibels = (formattedValue: string) => `${formattedValue} dB`;

// Each channel is named after the meter, and numbered when there are several.
const channelLabel = (index: number, count: number) =>
  label && count > 1 ? `${label} ${index + 1}` : label;
</script>

<Meter.Root
  {...rest}
  aria-label={label}
  data-marks={marks ? "labels" : undefined}
  data-size={size}
  {orientation}
  {scale}
>
  {#snippet children(
    state
  )}
    {#each Array.from(
      { length: state.channelCount },
      (_, index) => index
    ) as index (index)}
      <Meter.Channel
        aria-label={channelLabel(index, state.channelCount)}
        getAriaValueText={decibels}
        {index}
      >
        <Meter.Indicator />
        {#if peakMarks === "visible"}
          <Meter.Peak />
        {/if}
      </Meter.Channel>
    {/each}
    {#each marks ?? [] as level (level)}
      <Meter.Mark value={level}>
        <span
          aria-hidden="true"
          data-orientation={orientation}
          data-slot="meter-mark-tick"
        ></span>
        <span data-slot="meter-mark-label">{level}</span>
      </Meter.Mark>
    {/each}
  {/snippet}
</Meter.Root>
