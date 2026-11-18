<script lang="ts">
import type { ComponentProps, Snippet } from "svelte";
import type { FaderPublicState } from "@/primitives/fader";
import { parts } from "./parts";

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
