<script lang="ts">
import type { ComponentProps } from "svelte";
import { type Known, parts } from "./parts";

/** A stretch of the plot between two values on one axis. Style its `fill`. */
let {
  ...rest
}: Omit<Known<ComponentProps<typeof parts.Band>>, "children"> = $props();
</script>

<parts.Band {...rest}>
  {#snippet children(
    state
  )}
    <rect height={state.height} width={state.width} x={state.x} y={state.y} />
  {/snippet}
</parts.Band>
