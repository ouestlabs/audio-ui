<script lang="ts">
import type { KnobPublicState } from "@audio-ui/primitives/knob";
import type { Snippet } from "svelte";
import { parts } from "./parts.ts";

/** The thumb, with the native input that carries the knob's name inside it. */
let {
  "aria-label": label,
  children: content,
  getAriaValueText,
  ...rest
}: {
  "aria-label"?: string;
  children?: Snippet<[KnobPublicState]>;
  getAriaValueText?: (formatted: string, value: number) => string;
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
