<script lang="ts">
import type { KnobPublicState } from "@audio-ui/primitives/knob";
import type { Snippet } from "svelte";
import { parts } from "./parts.ts";

let { children: content, ...rest }: { children?: Snippet<[KnobPublicState]> } =
  $props();
</script>

<parts.Value {...rest}>
  {#snippet children(
    state
  )}
    {#if content}
      {@render content(state)}
    {:else}
      {state.formatted}
    {/if}
  {/snippet}
</parts.Value>
