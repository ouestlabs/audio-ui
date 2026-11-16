<script lang="ts">
import type { Note } from "@audio-ui/primitives/piano-roll";
import type { Snippet } from "svelte";
import { parts } from "./parts.ts";

/** The notes, in reading order: a note moved past another keeps its place in the DOM while it is dragged. */
let { children: draw }: { children: Snippet<[Note]> } = $props();
</script>

<parts.Notes>
  {#snippet children(
    state
  )}
    {#each state.notes as note (note.id)}
      {@render draw(note)}
    {/each}
  {/snippet}
</parts.Notes>
