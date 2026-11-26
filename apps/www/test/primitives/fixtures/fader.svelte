<script lang="ts">
import { Fader } from "@/registry/primitives/fader/svelte/index.ts";

/** The fader the shared suite drives: its options, its marks and how it is named. */
let {
  editable = false,
  label,
  marks = [],
  options = {},
  thumbLabel,
}: {
  editable?: boolean;
  label?: string;
  marks?: number[];
  options?: Record<string, unknown>;
  thumbLabel?: string;
} = $props();
</script>

<Fader.Root {...options}>
  {#if label}
    <Fader.Label>{label}</Fader.Label>
  {/if}
  <Fader.Control>
    <Fader.Track>
      <Fader.Indicator />
      {#each marks as mark (mark)}
        <Fader.Mark value={mark} />
      {/each}
    </Fader.Track>
    <Fader.Thumb aria-label={thumbLabel} />
  </Fader.Control>
  <Fader.Value {editable} />
</Fader.Root>
