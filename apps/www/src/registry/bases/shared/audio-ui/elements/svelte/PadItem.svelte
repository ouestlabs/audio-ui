<script lang="ts">
import type { ComponentProps, Snippet } from "svelte";
import { Pad } from "@/registry/primitives/pad/svelte/index";

/** One pad: give it a `value`, and a label as its content or `aria-label`. */
let {
  children,
  ...rest
}: Omit<ComponentProps<typeof Pad.Item>, "children"> & {
  children?: Snippet;
} = $props();
</script>

<Pad.Item {...rest}> {@render children?.()} </Pad.Item>
