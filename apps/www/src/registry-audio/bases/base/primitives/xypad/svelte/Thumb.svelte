<script lang="ts">
import type { XYPadPublicState } from "@/primitives/xypad";
import type { ComponentProps, Snippet } from "svelte";
import { parts } from "./parts";

type Axis = "x" | "y";

/** The thumb, with the two native inputs, one per axis, that carry the pad's name. */
let {
  "aria-label": label,
  children: content,
  getAriaLabel,
  getAriaValueText,
  ...rest
}: Omit<ComponentProps<typeof parts.Thumb>, "aria-label" | "children"> & {
  "aria-label"?: string;
  children?: Snippet<[XYPadPublicState]>;
  /** Names each axis input. Defaults to `aria-label` followed by "X" or "Y". */
  getAriaLabel?: (axis: Axis) => string;
  getAriaValueText?: (formatted: string, value: number, axis: Axis) => string;
} = $props();

const nameOf = (axis: Axis) =>
  getAriaLabel?.(axis) ??
  (label ? `${label} ${axis.toUpperCase()}` : undefined);
</script>

<parts.Thumb {...rest}>
  {#snippet children(
    state
  )}
    {@render content?.(state)}
    <parts.InputX aria-label={nameOf("x")} {getAriaValueText} />
    <parts.InputY aria-label={nameOf("y")} {getAriaValueText} />
  {/snippet}
</parts.Thumb>
