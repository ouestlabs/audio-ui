<script lang="ts">
import { Plot } from "@/registry/primitives/plot/svelte/index";

let peak = $state({ x: 1000, y: 6 });
const response = (hz: number, point: { x: number; y: number }) =>
  point.y * Math.exp(-(Math.log2(hz / point.x) ** 2));
const curve = (hz: number) => response(hz, peak);
</script>

<Plot.Root
  maxX={20_000}
  maxY={12}
  minX={20}
  minY={-12}
  onValueChange={(point) => {
    peak = point;
  }}
  scaleX="log"
>
  <Plot.Grid x={{ ticks: [100, 1000, 10_000] }} y={{ ticks: [-12, 0, 12] }} />
  <div data-slot="plot-graph">
    <Plot.Curve fillTo={0} fn={curve} />
    <Plot.Curve fn={curve} />
  </div>
  <Plot.Handle aria-label="Peak" handle="peak" value={peak} />
</Plot.Root>
