<script lang="ts">
import type { ComponentProps } from "svelte";
import { parts } from "./parts.ts";

/** A stretch of the plot between two values on one axis. Style its `fill`. */
let { ...rest }: Omit<ComponentProps<typeof parts.Band>, "children"> = $props();
</script>

<parts.Band {...rest}>
  {#snippet children(
    state
  )}
    <rect height={state.height} width={state.width} x={state.x} y={state.y} />
  {/snippet}
</parts.Band>
