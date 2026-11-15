<script lang="ts">
import { Piano } from "@/registry-audio/bases/base/primitives/piano/svelte/index.ts";

/** The keyboard the shared suite drives: its options and whether its keys have labels. */
let {
  labels = false,
  options = {},
}: { labels?: boolean; options?: Record<string, unknown> } = $props();
</script>

<Piano.Root {...options}>
  {#snippet children(
    state
  )}
    {#each state.pitches as pitch (pitch)}
      <Piano.Key {pitch}
        >{#if labels}
          <Piano.Label />
        {/if}</Piano.Key
      >
    {/each}
  {/snippet}
</Piano.Root>
