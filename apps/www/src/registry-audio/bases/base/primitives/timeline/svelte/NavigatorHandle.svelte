<script lang="ts">
import type { ComponentProps, Snippet } from "svelte";
import { parts } from "./parts.ts";

/** An edge of the navigator's window: dragging it zooms, holding the other edge still. */
let {
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  children: content,
  edge,
  getAriaValueText,
  ...rest
}: Omit<ComponentProps<typeof parts.NavigatorStart>, "children"> & {
  "aria-describedby"?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  children?: Snippet;
  edge: "end" | "start";
  getAriaValueText?: (value: number, duration: number) => string;
} = $props();
</script>

{#if edge === "start"}
  <parts.NavigatorStart {...rest}>
    {#snippet children()}
      {@render content?.()}
      <parts.NavigatorStartInput
        aria-describedby={describedBy}
        aria-label={label}
        aria-labelledby={labelledBy}
        {getAriaValueText}
      />
    {/snippet}
  </parts.NavigatorStart>
{:else}
  <parts.NavigatorEnd {...rest}>
    {#snippet children()}
      {@render content?.()}
      <parts.NavigatorEndInput
        aria-describedby={describedBy}
        aria-label={label}
        aria-labelledby={labelledBy}
        {getAriaValueText}
      />
    {/snippet}
  </parts.NavigatorEnd>
{/if}
