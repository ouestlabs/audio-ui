<script lang="ts">
import type { ComponentProps, Snippet } from "svelte";
import { parts } from "./parts.ts";

/** Sets one fade of the clip, by dragging or from the keyboard through its native input. A double click, or Enter, steps its shape. */
let {
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  children: content,
  clip,
  edge,
  getAriaValueText,
  ...rest
}: Omit<ComponentProps<typeof parts.ClipFadeInHandle>, "children"> & {
  "aria-describedby"?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  children?: Snippet;
  edge: "in" | "out";
  getAriaValueText?: (value: number, duration: number) => string;
} = $props();
</script>

{#if edge === "in"}
  <parts.ClipFadeInHandle {...rest} {clip}>
    {#snippet children()}
      {@render content?.()}
      <parts.ClipFadeInInput
        aria-describedby={describedBy}
        aria-label={label}
        aria-labelledby={labelledBy}
        {clip}
        {getAriaValueText}
      />
    {/snippet}
  </parts.ClipFadeInHandle>
{:else}
  <parts.ClipFadeOutHandle {...rest} {clip}>
    {#snippet children()}
      {@render content?.()}
      <parts.ClipFadeOutInput
        aria-describedby={describedBy}
        aria-label={label}
        aria-labelledby={labelledBy}
        {clip}
        {getAriaValueText}
      />
    {/snippet}
  </parts.ClipFadeOutHandle>
{/if}
