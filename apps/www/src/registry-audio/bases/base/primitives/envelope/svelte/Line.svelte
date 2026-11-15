<script lang="ts">
import type { ComponentProps } from "svelte";
import Polyline from "./Polyline.svelte";
import { parts } from "./parts.ts";

/** The curve through the points: an `<svg>` over the graph, drawn in its `color`. */
let {
  strokeWidth,
  ...rest
}: Omit<ComponentProps<typeof parts.Line>, "children" | "strokeWidth"> & {
  strokeWidth?: number;
} = $props();
</script>

<parts.Line {...rest} {strokeWidth}>
  {#snippet children(
    state
  )}
    <Polyline points={state.points} strokeWidth={strokeWidth ?? 2} />
  {/snippet}
</parts.Line>
