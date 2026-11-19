<script lang="ts">
import { Sequencer } from "@/registry/primitives/sequencer/svelte/index.ts";

/** The sequencer the shared suite drives: its options, its velocity bars and its source. */
let {
  options = {},
  velocityBars = false,
}: { options?: Record<string, unknown>; velocityBars?: boolean } = $props();
</script>

<Sequencer.Root {...options}>
  {#snippet children(
    state
  )}
    {#each Array.from({ length: state.rows }, (_, i) => i) as row (row)}
      <Sequencer.Row index={row}>
        {#each Array.from({ length: state.steps }, (_, i) => i) as step (step)}
          <Sequencer.Cell {row} {step} />
        {/each}
        {#if velocityBars}
          {#each Array.from(
            { length: state.steps },
            (_, i) => i
          ) as step (step)}
            <Sequencer.Velocity {row} {step} />
          {/each}
        {/if}
      </Sequencer.Row>
    {/each}
  {/snippet}
</Sequencer.Root>
