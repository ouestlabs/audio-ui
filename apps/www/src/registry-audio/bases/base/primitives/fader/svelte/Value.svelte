<script lang="ts">
import type { FaderPublicState } from "@audio-ui/primitives/fader";
import type { ComponentProps, Snippet } from "svelte";
import { parts } from "./parts.ts";

let {
  children: content,
  ...rest
}: Omit<ComponentProps<typeof parts.Value>, "children"> & {
  children?: Snippet<[FaderPublicState]>;
} = $props();
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
