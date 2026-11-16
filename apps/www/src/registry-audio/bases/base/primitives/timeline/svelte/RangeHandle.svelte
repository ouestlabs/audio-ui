<script lang="ts">
import type { ComponentProps, Snippet } from "svelte";
import { type Known, parts } from "./parts";

/** Resizes one edge of a range, by dragging or from the keyboard through its native input. */
let {
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  children: content,
  edge,
  getAriaValueText,
  range,
  ...rest
}: Omit<Known<ComponentProps<typeof parts.RangeStart>>, "children"> & {
  "aria-describedby"?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  children?: Snippet;
  edge: "end" | "start";
  getAriaValueText?: (value: number, duration: number) => string;
  /** The name of the range it belongs to. */
  range: string;
} = $props();
</script>

{#if edge === "start"}
  <parts.RangeStart {...rest} {range}>
    {#snippet children()}
      {@render content?.()}
      <parts.RangeStartInput
        aria-describedby={describedBy}
        aria-label={label}
        aria-labelledby={labelledBy}
        {getAriaValueText}
        {range}
      />
    {/snippet}
  </parts.RangeStart>
{:else}
  <parts.RangeEnd {...rest} {range}>
    {#snippet children()}
      {@render content?.()}
      <parts.RangeEndInput
        aria-describedby={describedBy}
        aria-label={label}
        aria-labelledby={labelledBy}
        {getAriaValueText}
        {range}
      />
    {/snippet}
  </parts.RangeEnd>
{/if}
