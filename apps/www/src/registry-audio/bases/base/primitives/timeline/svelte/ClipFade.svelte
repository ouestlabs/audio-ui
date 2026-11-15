<script lang="ts">
import type { ComponentProps } from "svelte";
import { parts } from "./parts.ts";

/** Shades a fade of the clip: its curve, in a 1 by 1 box. Style its `color` for the line, and `--clip-fade-shade` for the fill. */
let {
  clip,
  edge,
  ...rest
}: Omit<ComponentProps<typeof parts.ClipFadeIn>, "children"> & {
  edge: "in" | "out";
} = $props();
</script>

{#snippet shade(state: {
  fill: string;
  line: string;
})}
  <path d={state.fill} style="fill: var(--clip-fade-shade, currentColor)" />
  <path
    d={state.line}
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    style="vector-effect: non-scaling-stroke"
  />
{/snippet}

{#if edge === "in"}
  <parts.ClipFadeIn {...rest} {clip}>
    {#snippet children(
      state
    )}
      {@render shade(state)}
    {/snippet}
  </parts.ClipFadeIn>
{:else}
  <parts.ClipFadeOut {...rest} {clip}>
    {#snippet children(
      state
    )}
      {@render shade(state)}
    {/snippet}
  </parts.ClipFadeOut>
{/if}
