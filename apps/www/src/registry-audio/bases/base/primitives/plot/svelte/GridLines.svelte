<svelte:options namespace="svg" />

<script lang="ts">
import type { GridTick } from "@audio-ui/primitives/plot";

let { columns, rows }: { columns: GridTick[]; rows: GridTick[] } = $props();
</script>

{#each columns as tick (`x-${tick.value}`)}
  <line
    data-axis="x"
    data-part="line"
    data-zero={tick.value === 0 ? "" : undefined}
    style="vector-effect: non-scaling-stroke"
    x1={tick.position}
    x2={tick.position}
    y1={0}
    y2={1}
  />
{/each}
{#each rows as tick (`y-${tick.value}`)}
  <line
    data-axis="y"
    data-part="line"
    data-zero={tick.value === 0 ? "" : undefined}
    style="vector-effect: non-scaling-stroke"
    x1={0}
    x2={1}
    y1={1 - tick.position}
    y2={1 - tick.position}
  />
{/each}
