<script lang="ts">
import { DEFAULT_ARC_STROKE_WIDTH } from "@audio-ui/core/knob";
import type { ComponentProps } from "svelte";
import Arc from "./Arc.svelte";
import { parts } from "./parts.ts";

let {
  strokeWidth,
  ...rest
}: Omit<ComponentProps<typeof parts.Track>, "children" | "strokeWidth"> & {
  strokeWidth?: number;
} = $props();
</script>

<parts.Track {...rest} {strokeWidth}>
  {#snippet children(
    state
  )}
    <Arc d={state.arc} strokeWidth={strokeWidth ?? DEFAULT_ARC_STROKE_WIDTH} />
  {/snippet}
</parts.Track>
