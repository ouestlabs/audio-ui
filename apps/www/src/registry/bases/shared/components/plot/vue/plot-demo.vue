<script lang="ts" setup>
import { ref } from "vue";
import { Plot } from "@/registry/primitives/plot/vue";

const peak = ref({ x: 1000, y: 6 });
const response = (hz: number, point: { x: number; y: number }) =>
  point.y * Math.exp(-(Math.log2(hz / point.x) ** 2));
const curve = (hz: number) => response(hz, peak.value);
</script>

<template>
  <Plot.Root
    scale-x="log"
    :max-x="20_000"
    :max-y="12"
    :min-x="20"
    :min-y="-12"
    @value-change="(point) => { peak = point; }"
  >
    <Plot.Grid
      :x="{ ticks: [100, 1000, 10_000] }"
      :y="{ ticks: [-12, 0, 12] }"
    />
    <div data-slot="plot-graph">
      <Plot.Curve :fill-to="0" :fn="curve" />
      <Plot.Curve :fn="curve" />
    </div>
    <Plot.Handle aria-label="Peak" handle="peak" :value="peak" />
  </Plot.Root>
</template>
