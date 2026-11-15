<script lang="ts">
import type { HandleState } from "@audio-ui/primitives/plot";
import type { ComponentProps, Snippet } from "svelte";
import { parts } from "./parts.ts";

/**
 * A point on the plot that can be moved, in the axes' units, with a native
 * `<input type="range">` for each axis it moves along carrying the names.
 */
let {
  "aria-label": label,
  axis = "both",
  children: content,
  getAriaLabel,
  getAriaValueText,
  handle,
  ...rest
}: Omit<ComponentProps<typeof parts.Handle>, "aria-label" | "children"> & {
  "aria-label"?: string;
  children?: Snippet<[HandleState]>;
  /** Names each axis input. Defaults to `aria-label`, followed by "X" or "Y" when the handle moves along both. */
  getAriaLabel?: (axis: "x" | "y") => string | undefined;
  /** Returns an axis input's `aria-valuetext`, from its value. */
  getAriaValueText?: (value: number, axis: "x" | "y") => string;
} = $props();

const nameOf = (along: "x" | "y") =>
  getAriaLabel?.(along) ??
  (label && axis === "both" ? `${label} ${along.toUpperCase()}` : label);
</script>

<parts.Handle {...rest} {axis} {handle}>
  {#snippet children(
    state
  )}
    {@render content?.(state)}
    {#if axis !== "y"}
      <parts.InputX getAriaLabel={nameOf} {getAriaValueText} {handle} />
    {/if}
    {#if axis !== "x"}
      <parts.InputY getAriaLabel={nameOf} {getAriaValueText} {handle} />
    {/if}
  {/snippet}
</parts.Handle>
