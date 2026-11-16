<script lang="ts">
import type { ComponentProps, Snippet } from "svelte";
import { type Known, parts } from "./parts";

/**
 * A stretch of a source laid on a lane: a recording, a pattern. Its parts
 * (the header, the handles, the fades) take the same `clip` name. Its own
 * native `<input type="range">` moves it from the keyboard and carries its
 * name, unless it is not `movable`.
 */
let {
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  children: content,
  clip,
  getAriaValueText,
  movable = true,
  ...rest
}: Omit<Known<ComponentProps<typeof parts.Clip>>, "children"> & {
  "aria-describedby"?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  children?: Snippet;
  /** Returns how a position is announced. Defaults to the number. */
  getAriaValueText?: (value: number, duration: number) => string;
} = $props();
</script>

<parts.Clip {...rest} {clip} {movable}>
  {#snippet children()}
    {@render content?.()}
    {#if movable}
      <parts.ClipInput
        aria-describedby={describedBy}
        aria-label={label}
        aria-labelledby={labelledBy}
        {clip}
        {getAriaValueText}
      />
    {/if}
  {/snippet}
</parts.Clip>
