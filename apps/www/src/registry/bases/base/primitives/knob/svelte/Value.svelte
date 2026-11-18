<script lang="ts">
import type { KnobPublicState } from "@/primitives/knob";
import type { ComponentProps, Snippet } from "svelte";
import { parts } from "./parts";

let {
  children: content,
  ...rest
}: Omit<ComponentProps<typeof parts.Value>, "children"> & {
  children?: Snippet<[KnobPublicState]>;
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
