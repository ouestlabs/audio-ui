<script lang="ts">
import { Plot } from "@/registry/bases/shared/primitives/plot/svelte/index";

let peak = $state({ x: 1000, y: 6 });
const response = (hz: number, point: { x: number; y: number }) =>
  point.y * Math.exp(-(Math.log2(hz / point.x) ** 2));
const curve = (hz: number) => response(hz, peak);
</script>

<Plot.Root
  class="cn-plot relative h-48 w-full touch-none select-none data-disabled:opacity-50"
  maxX={20_000}
  maxY={12}
  minX={20}
  minY={-12}
  onValueChange={(point) => {
    peak = point;
  }}
  scaleX="log"
>
  <Plot.Grid
    class="cn-plot-grid rounded-[inherit] text-[10px] text-muted-foreground tabular-nums leading-none [&>svg]:overflow-hidden! [&>svg]:rounded-[inherit] [&_[data-part=line]]:stroke-border [&_[data-part=line][data-zero]]:stroke-foreground/30 [&_[data-part=label]]:z-1 [&_[data-part=label]]:px-0.5 [&_[data-part=label]]:[text-shadow:0_0_2px_var(--card),0_0_2px_var(--card),0_0_4px_var(--card)] [&_[data-part=label][data-axis=x]]:-translate-x-1/2 [&_[data-part=label][data-axis=x]]:bottom-1.5 [&_[data-part=label][data-axis=y]]:-translate-y-1/2 [&_[data-part=label][data-axis=y]]:left-2"
    x={{ ticks: [100, 1000, 10_000] }}
    y={{ ticks: [-12, 0, 12] }}
  />
  <div
    class="cn-plot-graph absolute inset-0 overflow-hidden! rounded-[inherit]"
  >
    <Plot.Curve class="cn-plot-area stroke-none" fillTo={0} fn={curve} />
    <Plot.Curve
      class="cn-plot-curve fill-none [stroke-linecap:round] [stroke-linejoin:round]"
      fn={curve}
    />
  </div>
  <Plot.Handle
    aria-label="Peak"
    class="cn-plot-handle size-4 cursor-grab outline-none after:absolute after:-inset-2 pointer-coarse:after:-inset-3.5 data-dragging:cursor-grabbing data-disabled:pointer-events-none"
    handle="peak"
    value={peak}
  />
</Plot.Root>
