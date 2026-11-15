<script lang="ts">
import type { ComponentProps } from "svelte";
import GridLines from "./GridLines.svelte";
import { parts } from "./parts.ts";

/** Grid lines and their labels: `data-part="line"` and `data-part="label"`, each with `data-axis`. */
let { ...rest }: Omit<ComponentProps<typeof parts.Grid>, "children"> = $props();
</script>

<parts.Grid {...rest}>
  {#snippet children(
    state
  )}
    <svg
      aria-hidden="true"
      height="100%"
      preserveAspectRatio="none"
      style="inset: 0; overflow: visible; position: absolute"
      viewBox="0 0 1 1"
      width="100%"
    >
      <GridLines columns={state.columns} rows={state.rows} />
    </svg>
    {#each state.columns as tick (`x-${tick.value}`)}
      {#if tick.label !== null}
        <div
          data-axis="x"
          data-part="label"
          style={`left: ${tick.position * 100}%; position: absolute`}
        >
          {tick.label}
        </div>
      {/if}
    {/each}
    {#each state.rows as tick (`y-${tick.value}`)}
      {#if tick.label !== null}
        <div
          data-axis="y"
          data-part="label"
          style={`position: absolute; top: ${(1 - tick.position) * 100}%`}
        >
          {tick.label}
        </div>
      {/if}
    {/each}
  {/snippet}
</parts.Grid>
