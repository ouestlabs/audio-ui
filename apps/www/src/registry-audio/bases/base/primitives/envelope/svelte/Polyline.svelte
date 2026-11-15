<svelte:options namespace="svg" />

<script lang="ts">
let {
  filled = false,
  points,
  strokeWidth = 2,
}: { filled?: boolean; points: string; strokeWidth?: number } = $props();
</script>

{#if filled}
  <polyline fill="currentColor" {points} stroke="none" />
{:else}
  <polyline
    fill="none"
    {points}
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width={strokeWidth}
    style="vector-effect: non-scaling-stroke"
  />
{/if}
