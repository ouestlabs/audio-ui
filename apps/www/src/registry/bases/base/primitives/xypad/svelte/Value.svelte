<script lang="ts">
import type { ComponentProps, Snippet } from "svelte";
import type { XYPadPublicState } from "@/primitives/xypad";
import { parts } from "./parts";

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
