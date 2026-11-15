<script lang="ts">
import type { ComponentProps, Snippet } from "svelte";
import { parts } from "./parts.ts";

/** Trims one edge of the clip, by dragging or from the keyboard through its native input: it moves where in the source the clip begins instead of stretching it. */
let {
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  children: content,
  clip,
  edge,
  getAriaValueText,
  ...rest
}: Omit<ComponentProps<typeof parts.ClipTrimStart>, "children"> & {
  "aria-describedby"?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  children?: Snippet;
  edge: "start" | "end";
  getAriaValueText?: (value: number, duration: number) => string;
} = $props();
</script>

{#if edge === "start"}
  <parts.ClipTrimStart {...rest} {clip}>
    {#snippet children()}
      {@render content?.()}
      <parts.ClipTrimStartInput
        aria-describedby={describedBy}
        aria-label={label}
        aria-labelledby={labelledBy}
        {clip}
        {getAriaValueText}
      />
    {/snippet}
  </parts.ClipTrimStart>
{:else}
  <parts.ClipTrimEnd {...rest} {clip}>
    {#snippet children()}
      {@render content?.()}
      <parts.ClipTrimEndInput
        aria-describedby={describedBy}
        aria-label={label}
        aria-labelledby={labelledBy}
        {clip}
        {getAriaValueText}
      />
    {/snippet}
  </parts.ClipTrimEnd>
{/if}
