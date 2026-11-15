<script lang="ts">
import type { XYPadPublicState } from "@audio-ui/primitives/xypad";
import type { ComponentProps, Snippet } from "svelte";
import { parts } from "./parts.ts";

let {
  children: content,
  ...rest
}: Omit<ComponentProps<typeof parts.Value>, "children"> & {
  children?: Snippet<[XYPadPublicState]>;
} = $props();
</script>

<parts.Value {...rest}>
  {#snippet children(
    state
  )}
    {#if content}
      {@render content(state)}
    {:else}
      {state.formattedPair}
    {/if}
  {/snippet}
</parts.Value>
