<script lang="ts">
import type { ComponentProps } from "svelte";
import Path from "./Path.svelte";
import { parts } from "./parts.ts";

/** A live line across the plot, drawn straight in the DOM from a source. Style its `stroke` and `fill`. */
let {
  ...rest
}: Omit<ComponentProps<typeof parts.Trace>, "children"> = $props();
</script>

<parts.Trace {...rest}>
  {#snippet children(
    state
  )}
    <Path d={state.d} />
  {/snippet}
</parts.Trace>
