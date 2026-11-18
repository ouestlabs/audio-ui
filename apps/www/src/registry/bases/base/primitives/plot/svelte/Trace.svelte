<script lang="ts">
import type { ComponentProps } from "svelte";
import Path from "./Path.svelte";
import { type Known, parts } from "./parts";

/** A live line across the plot, drawn straight in the DOM from a source. Style its `stroke` and `fill`. */
let {
  ...rest
}: Omit<Known<ComponentProps<typeof parts.Trace>>, "children"> = $props();
</script>

<parts.Trace {...rest}>
  {#snippet children(
    state
  )}
    <Path d={state.d} />
  {/snippet}
</parts.Trace>
