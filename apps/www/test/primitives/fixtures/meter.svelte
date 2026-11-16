<script lang="ts">
import { Meter } from "@/registry-audio/bases/base/primitives/meter/svelte/index.ts";

/** The meter the shared suite drives: its options, its marks and its labels. */
let {
  decibels,
  labels = false,
  marks = [],
  options = {},
}: {
  decibels: (formatted: string) => string;
  labels?: boolean;
  marks?: number[];
  options?: Record<string, unknown>;
} = $props();
</script>

<Meter.Root aria-label="Output" {...options}>
  {#snippet children(
    state
  )}
    {#each marks as mark (mark)}
      <Meter.Mark value={mark} />
    {/each}
    {#each Array.from(
      { length: state.channelCount },
      (_, index) => index
    ) as index (index)}
      <Meter.Channel
        aria-label={`Output ${index + 1}`}
        getAriaValueText={decibels}
        {index}
      >
        <Meter.Track>
          <Meter.Indicator />
          <Meter.Peak />
        </Meter.Track>
        {#if labels}
          <Meter.Label>Channel</Meter.Label>
        {/if}
        <Meter.Value />
      </Meter.Channel>
    {/each}
  {/snippet}
</Meter.Root>
