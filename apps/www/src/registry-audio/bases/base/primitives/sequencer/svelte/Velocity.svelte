<script lang="ts">
import type { VelocityState } from "@audio-ui/primitives/sequencer";
import type { ComponentProps, Snippet } from "svelte";
import { type Known, parts } from "./parts";

/**
 * How loud one step plays, as a bar whose height is the `--sequencer-velocity`
 * CSS variable, with the native range input that carries its name inside it.
 */
let {
  "aria-label": label,
  children: content,
  getAriaValueText,
  row,
  step,
  ...rest
}: Omit<
  Known<ComponentProps<typeof parts.Velocity>>,
  "aria-label" | "cell" | "children"
> & {
  "aria-label"?: string;
  children?: Snippet<[VelocityState]>;
  /** Announces the velocity in your own words. Defaults to a percentage. */
  getAriaValueText?: (velocity: number) => string;
} = $props();
</script>

<parts.Velocity {...rest} cell={`${row}:${step}`} {row} {step}>
  {#snippet children(
    state
  )}
    {@render content?.(state)}
    <parts.VelocityInput
      aria-label={label ?? `Step ${step + 1}`}
      cell={`${row}:${step}`}
      {getAriaValueText}
      {row}
      {step}
    />
  {/snippet}
</parts.Velocity>
