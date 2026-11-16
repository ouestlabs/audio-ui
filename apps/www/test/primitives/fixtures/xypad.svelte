<script lang="ts">
import { XYPad } from "@/registry-audio/bases/base/primitives/xypad/svelte/index.ts";

/** The pad the shared suite drives: its options and how it is named. */
let {
  label,
  options = {},
  thumbLabel,
}: {
  label?: string;
  options?: Record<string, unknown>;
  thumbLabel?: string;
} = $props();
</script>

<XYPad.Root {...options}>
  {#if label}
    <XYPad.Label>{label}</XYPad.Label>
  {/if}
  <XYPad.Control>
    <XYPad.Thumb aria-label={thumbLabel} />
  </XYPad.Control>
  <XYPad.Value />
</XYPad.Root>
