<script lang="ts">
import type { ComponentProps } from "svelte";
import { DEFAULT_ARC_STROKE_WIDTH } from "@/primitives/knob";
import Arc from "./Arc.svelte";
import { parts } from "./parts";

let {
  strokeWidth,
  ...rest
}: Omit<ComponentProps<typeof parts.Indicator>, "children" | "strokeWidth"> & {
  strokeWidth?: number;
} = $props();
</script>

<parts.Indicator {...rest} {strokeWidth}>
  {#snippet children(
    state
  )}
    <Arc d={state.arc} strokeWidth={strokeWidth ?? DEFAULT_ARC_STROKE_WIDTH} />
  {/snippet}
</parts.Indicator>
