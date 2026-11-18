<svelte:options namespace="svg" />

<script lang="ts">
let { d, strokeWidth }: { d: string | null; strokeWidth: number } = $props();
</script>

{#if d}
  <path
    {d}
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-width={strokeWidth}
  />
{/if}
