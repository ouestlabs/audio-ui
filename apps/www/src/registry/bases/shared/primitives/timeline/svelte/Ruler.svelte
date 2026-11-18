<script lang="ts">
import type { ComponentProps, Snippet } from "svelte";
import { type Known, parts } from "./parts";

/**
 * The lane that moves the position: a press jumps to the pointer and a drag
 * scrubs, on the grid unless Cmd/Ctrl is held. It holds the native
 * `<input type="range">` that takes focus and the keys and carries the name.
 */
let {
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  children: content,
  getAriaValueText,
  ...rest
}: Omit<Known<ComponentProps<typeof parts.Ruler>>, "children"> & {
  "aria-describedby"?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  children?: Snippet;
  /** Returns how the position is announced, e.g. `"bar 3, beat 2"`. Defaults to the number. */
  getAriaValueText?: (value: number, duration: number) => string;
} = $props();
</script>

<parts.Ruler {...rest}>
  {#snippet children()}
    {@render content?.()}
    <parts.RulerInput
      aria-describedby={describedBy}
      aria-label={label}
      aria-labelledby={labelledBy}
      {getAriaValueText}
    />
  {/snippet}
</parts.Ruler>
