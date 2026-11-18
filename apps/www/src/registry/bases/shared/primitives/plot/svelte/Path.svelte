<svelte:options namespace="svg" />

<script lang="ts">
let { d }: { d: string } = $props();
</script>

<path {d} data-plot="path" style="vector-effect: non-scaling-stroke" />
