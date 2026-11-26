<script lang="ts">
import type { ComponentProps, Snippet } from "svelte";
import { Pad } from "@/registry/primitives/pad/svelte/index";

/** A grid of pads to strike, `columns` to a row: put a `PadItem` in it for each. */
let {
  children,
  columns = 4,
  style,
  ...rest
}: Omit<ComponentProps<typeof Pad.Root>, "children" | "style"> & {
  children?: Snippet;
  columns?: number;
  style?: string;
} = $props();
</script>

<Pad.Root {...rest} {columns} style="--pad-columns: {columns}; {style ?? ""}">
  {@render children?.()}
</Pad.Root>
