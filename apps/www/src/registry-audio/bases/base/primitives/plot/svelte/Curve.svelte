<script lang="ts">
import type { ComponentProps } from "svelte";
import Path from "./Path.svelte";
import { type Known, parts } from "./parts";

/** A curve across the plot: `y = fn(x)` in the axes' units. Style its `stroke` and `fill`. */
let {
  ...rest
}: Omit<Known<ComponentProps<typeof parts.Curve>>, "children"> = $props();
</script>

<parts.Curve {...rest}>
  {#snippet children(
    state
  )}
    <Path d={state.d} />
  {/snippet}
</parts.Curve>
