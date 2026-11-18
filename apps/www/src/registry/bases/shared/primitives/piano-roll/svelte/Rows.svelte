<script lang="ts">
import type { Snippet } from "svelte";
import { parts } from "./parts";

/** The rows, one for each pitch drawn, highest first. */
let { children: draw }: { children: Snippet<[number]> } = $props();
</script>

<parts.Rows>
  {#snippet children(
    state
  )}
    {#each state.pitches as pitch (pitch)}
      {@render draw(pitch)}
    {/each}
  {/snippet}
</parts.Rows>
