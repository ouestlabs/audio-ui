<script lang="ts">
import type { ComponentProps, Snippet } from "svelte";
import { type Known, parts } from "./parts";

/** The stretch the viewport shows, inside the navigator: dragging it scrolls. Its native input moves it from the keyboard. */
let {
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  children: content,
  getAriaValueText,
  ...rest
}: Omit<Known<ComponentProps<typeof parts.NavigatorWindow>>, "children"> & {
  "aria-describedby"?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  children?: Snippet;
  getAriaValueText?: (value: number, duration: number) => string;
} = $props();
</script>

<parts.NavigatorWindow {...rest}>
  {#snippet children()}
    {@render content?.()}
    <parts.NavigatorWindowInput
      aria-describedby={describedBy}
      aria-label={label}
      aria-labelledby={labelledBy}
      {getAriaValueText}
    />
  {/snippet}
</parts.NavigatorWindow>
