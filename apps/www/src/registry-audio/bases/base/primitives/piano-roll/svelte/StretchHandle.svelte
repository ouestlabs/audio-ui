<script lang="ts">
import type { ComponentProps } from "svelte";
import { type Known, parts } from "./parts";

/** Stretches the selected notes from one edge of their span. Place it inside a `SelectionSpan`. */
let {
  edge,
  ...rest
}: Omit<Known<ComponentProps<typeof parts.StretchStart>>, "children"> & {
  edge: "end" | "start";
} = $props();
</script>

{#if edge === "start"}
  <parts.StretchStart {...rest} />
{:else}
  <parts.StretchEnd {...rest} />
{/if}
