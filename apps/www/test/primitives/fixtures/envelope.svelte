<script lang="ts">
import { Envelope } from "@/registry-audio/bases/base/primitives/envelope/svelte/index.ts";

/** The envelope the shared suite drives: its options. */
let { options = {} }: { options?: Record<string, unknown> } = $props();
</script>

<Envelope.Root {...options}>
  {#snippet children(
    state
  )}
    <Envelope.Graph>
      <Envelope.Fill />
      <Envelope.Line />
    </Envelope.Graph>
    {#each state.value as _, index (index)}
      <Envelope.Point aria-label={`Point ${index + 1}`} {index} />
    {/each}
    {#each state.value.slice(0, -1) as _, index (index)}
      <Envelope.Segment aria-label={`Curve ${index + 1}`} {index} />
    {/each}
  {/snippet}
</Envelope.Root>
