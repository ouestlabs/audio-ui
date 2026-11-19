<script lang="ts">
import type { ComponentProps, Snippet } from "svelte";
import type { FaderPublicState } from "@/primitives/fader";
import { parts } from "./parts";

/** The thumb, with the native input that carries the fader's name inside it. */
let {
  "aria-label": label,
  children: content,
  getAriaValueText,
  ...rest
}: Omit<ComponentProps<typeof parts.Thumb>, "aria-label" | "children"> & {
  "aria-label"?: string;
  children?: Snippet<[FaderPublicState]>;
  getAriaValueText?: (
    formatted: string,
    value: number,
    index: number
  ) => string;
} = $props();
</script>

<parts.Thumb {...rest}>
  {#snippet children(
    state
  )}
    {@render content?.(state)}
    <parts.Input aria-label={label} {getAriaValueText} />
  {/snippet}
</parts.Thumb>
