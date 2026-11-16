<script lang="ts">
import type { ComponentProps, Snippet } from "svelte";
import { type Known, parts } from "./parts";

/**
 * The seekable surface: a press jumps to the pointer and a drag scrubs. It
 * holds the native `<input type="range">` that takes focus, handles the
 * keyboard and carries the accessible name. Leave it out for a waveform that
 * is only shown.
 */
let {
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  children: content,
  getAriaValueText,
  ...rest
}: Omit<Known<ComponentProps<typeof parts.Control>>, "children"> & {
  "aria-describedby"?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  children?: Snippet;
  /** Returns how the position is announced, e.g. `"0:12 of 1:42"`. Defaults to the played share, e.g. `"30%"`. */
  getAriaValueText?: (value: number, duration: number) => string;
} = $props();
</script>

<parts.Control {...rest}>
  {#snippet children()}
    {@render content?.()}
    <parts.Input
      aria-describedby={describedBy}
      aria-label={label}
      aria-labelledby={labelledBy}
      {getAriaValueText}
    />
  {/snippet}
</parts.Control>
