<script lang="ts">
import type { ComponentProps } from "svelte";
import { parts } from "./parts.ts";

/** A straight line across the plot at a value. Style its `stroke`. */
let { ...rest }: Omit<ComponentProps<typeof parts.Line>, "children"> = $props();
</script>

<parts.Line {...rest}>
  {#snippet children(
    state
  )}
    <line
      style="vector-effect: non-scaling-stroke"
      x1={state.x1}
      x2={state.x2}
      y1={state.y1}
      y2={state.y2}
    />
  {/snippet}
</parts.Line>
