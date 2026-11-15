<script lang="ts">
import type { ComponentProps, Snippet } from "svelte";
import { parts } from "./parts.ts";

/**
 * A stretch laid over a lane, such as a loop or a selection. Its edges take
 * the same `range` name. Its own native `<input type="range">` moves it from
 * the keyboard and carries its name, unless it is not `movable`.
 */
let {
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  children: content,
  getAriaValueText,
  movable = true,
  range,
  ...rest
}: Omit<ComponentProps<typeof parts.Range>, "children"> & {
  "aria-describedby"?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  children?: Snippet;
  getAriaValueText?: (value: number, duration: number) => string;
} = $props();
</script>

<parts.Range {...rest} {movable} {range}>
  {#snippet children()}
    {@render content?.()}
    {#if movable}
      <parts.RangeInput
        aria-describedby={describedBy}
        aria-label={label}
        aria-labelledby={labelledBy}
        {getAriaValueText}
        {range}
      />
    {/if}
  {/snippet}
</parts.Range>
