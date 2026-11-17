<script lang="ts">
import type { ChannelPublicState } from "@/primitives/meter";
import type { ComponentProps, Snippet } from "svelte";
import { parts } from "./parts";

let {
  children: content,
  ...rest
}: Omit<ComponentProps<typeof parts.Value>, "children"> & {
  children?: Snippet<[ChannelPublicState]>;
} = $props();
</script>

<parts.Value {...rest}>
  {#snippet children(
    state
  )}
    {#if content}
      {@render content(state)}
    {:else}
      {state.text}
    {/if}
  {/snippet}
</parts.Value>
