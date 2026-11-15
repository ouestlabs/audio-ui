<script lang="ts">
import type { ComponentProps, Snippet } from "svelte";
import { parts } from "./parts.ts";

/** The levels as a fixed number of elements, one `Waveform.Bar` each, styled in plain CSS from `--waveform-level`. */
let {
  bar,
  count = 24,
  ...rest
}: Omit<ComponentProps<typeof parts.Bars>, "children"> & {
  /** Draws one bar. Left out, plain bars are rendered. */
  bar?: Snippet<[number, number]>;
} = $props();
</script>

<parts.Bars {count} {...rest}>
  {#snippet children()}
    {#each Array.from({ length: count }, (_, i) => i) as index (index)}
      {#if bar}
        {@render bar(index, count)}
      {:else}
        <parts.Bar {index} />
      {/if}
    {/each}
  {/snippet}
</parts.Bars>
