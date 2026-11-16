<script lang="ts">
import type { ComponentProps, Snippet } from "svelte";
import { type Known, parts } from "./parts";

/** Resizes one edge of a region, by dragging or from the keyboard through its native input. */
let {
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  children: content,
  edge,
  getAriaValueText,
  region,
  ...rest
}: Omit<Known<ComponentProps<typeof parts.RegionStart>>, "children"> & {
  "aria-describedby"?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  children?: Snippet;
  /** The edge of the region this handle resizes. */
  edge: "end" | "start";
  /** Returns how the edge's position is announced. Defaults to its share, e.g. `"30%"`. */
  getAriaValueText?: (value: number, duration: number) => string;
  /** The name of the region it belongs to. */
  region: string;
} = $props();
</script>

{#if edge === "start"}
  <parts.RegionStart {...rest} {region}>
    {#snippet children()}
      {@render content?.()}
      <parts.RegionStartInput
        aria-describedby={describedBy}
        aria-label={label}
        aria-labelledby={labelledBy}
        {getAriaValueText}
        {region}
      />
    {/snippet}
  </parts.RegionStart>
{:else}
  <parts.RegionEnd {...rest} {region}>
    {#snippet children()}
      {@render content?.()}
      <parts.RegionEndInput
        aria-describedby={describedBy}
        aria-label={label}
        aria-labelledby={labelledBy}
        {getAriaValueText}
        {region}
      />
    {/snippet}
  </parts.RegionEnd>
{/if}
