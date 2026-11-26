<script lang="ts">
import type { ComponentProps } from "svelte";
import { XYPad } from "@/registry/primitives/xypad/svelte/index";

let {
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  fill = false,
  formatValue,
  size = "default",
  valueDisplay = "visible",
  ...rest
}: Omit<ComponentProps<typeof XYPad.Root>, "children"> & {
  "aria-describedby"?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /** Takes the height left in a column in place of its size's, down to a strip: in a short panel it gives way to the controls under it. */
  fill?: boolean;
  /** Prints the value in the display, e.g. as `"440 Hz · 70 %"`. */
  formatValue?: (value: { x: number; y: number }) => string;
  size?: "sm" | "default" | "lg" | "xl";
  valueDisplay?: "visible" | "hidden";
} = $props();

const LINES = [20, 40, 60, 80];
</script>

<XYPad.Root {...rest} data-fill={fill ? "" : undefined} data-size={size}>
  <XYPad.Control>
    <div aria-hidden="true" data-slot="xypad-grid">
      {#each LINES as position (`vertical-${position}`)}
        <div
          data-orientation="vertical"
          data-slot="xypad-grid-line"
          style:left="{position}%"
        ></div>
      {/each}
      {#each LINES as position (`horizontal-${position}`)}
        <div
          data-orientation="horizontal"
          data-slot="xypad-grid-line"
          style:top="{position}%"
        ></div>
      {/each}
    </div>
    <div
      aria-hidden="true"
      data-orientation="vertical"
      data-slot="xypad-crosshair"
    ></div>
    <div
      aria-hidden="true"
      data-orientation="horizontal"
      data-slot="xypad-crosshair"
    ></div>
    <XYPad.Thumb
      aria-describedby={describedBy}
      aria-label={label}
      aria-labelledby={labelledBy}
    >
      <div data-slot="xypad-cursor-glow"></div>
      <div data-slot="xypad-cursor-dot"></div>
      <div data-slot="xypad-cursor-highlight"></div>
    </XYPad.Thumb>
    {#if valueDisplay === "visible"}
      {#if formatValue}
        <XYPad.Value>
          {#snippet children(
            state
          )}
            {formatValue(state.value)}
          {/snippet}
        </XYPad.Value>
      {:else}
        <XYPad.Value />
      {/if}
    {/if}
  </XYPad.Control>
</XYPad.Root>
