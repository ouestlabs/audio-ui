<script lang="ts">
import type { ComponentProps, Snippet } from "svelte";
import { parts } from "./parts";

/** The name of the key it sits in, such as "C4", unless it has content of its own. */
let {
  children: content,
  ...rest
}: Omit<ComponentProps<typeof parts.Label>, "children"> & {
  children?: Snippet<[{ name: string }]>;
} = $props();
</script>

<parts.Label {...rest}>
  {#snippet children(
    state
  )}
    {#if content}
      {@render content(state)}
    {:else}
      {state.name}
    {/if}
  {/snippet}
</parts.Label>
