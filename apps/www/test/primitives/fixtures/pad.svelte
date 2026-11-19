<script lang="ts">
import { Pad } from "@/registry/primitives/pad/svelte/index.ts";

/** The grid the shared suite drives: its options and its pads. */
let {
  options = {},
  pads = [],
}: {
  options?: Record<string, unknown>;
  pads?: { chokeGroup?: string; disabled?: boolean; value: string }[];
} = $props();
</script>

<Pad.Root {...options}>
  {#each pads as pad (pad.value)}
    <Pad.Item
      chokeGroup={pad.chokeGroup}
      disabled={pad.disabled}
      value={pad.value}
      >{pad.value}</Pad.Item
    >
  {/each}
</Pad.Root>
