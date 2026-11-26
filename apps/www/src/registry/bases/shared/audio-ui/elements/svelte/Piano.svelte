<script lang="ts">
import type { ComponentProps } from "svelte";
import { Piano } from "@/registry/primitives/piano/svelte/index";

let {
  size = "default",
  ...rest
}: Omit<ComponentProps<typeof Piano.Root>, "children"> & {
  size?: "sm" | "default" | "lg";
} = $props();
</script>

<Piano.Root {...rest} data-size={size}>
  {#snippet children(
    state
  )}
    {#each state.pitches as pitch (pitch)}
      <Piano.Key {pitch} />
    {/each}
  {/snippet}
</Piano.Root>
