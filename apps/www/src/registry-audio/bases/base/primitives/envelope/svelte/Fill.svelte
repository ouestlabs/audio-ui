<script lang="ts">
import type { ComponentProps } from "svelte";
import Polyline from "./Polyline.svelte";
import { parts } from "./parts.ts";

/** The area under the curve: an `<svg>` over the graph, filled with its `color`. */
let { ...rest }: Omit<ComponentProps<typeof parts.Fill>, "children"> = $props();
</script>

<parts.Fill {...rest}>
  {#snippet children(
    state
  )}
    <Polyline filled points={state.points} />
  {/snippet}
</parts.Fill>
