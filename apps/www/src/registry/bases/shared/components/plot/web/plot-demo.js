import "@/registry/bases/shared/primitives/plot/web";

const response = (hz, point) =>
  point.y * Math.exp(-(Math.log2(hz / point.x) ** 2));

/** Draws the plot into `element`, and returns what takes it away. A curve is a function, so it is set as a property. */
export default function plotWebDemo(element) {
  element.innerHTML = `
    <audio-ui-plot class="block cn-plot relative h-48 w-full touch-none select-none data-disabled:opacity-50" max-x="20000" max-y="12" min-x="20" min-y="-12" scale-x="log">
      <audio-ui-plot-grid class="cn-plot-grid rounded-[inherit] text-[10px] text-muted-foreground tabular-nums leading-none [&>svg]:overflow-hidden! [&>svg]:rounded-[inherit] [&_[data-part=line]]:stroke-border [&_[data-part=line][data-zero]]:stroke-foreground/30 [&_[data-part=label]]:z-1 [&_[data-part=label]]:px-0.5 [&_[data-part=label]]:[text-shadow:0_0_2px_var(--card),0_0_2px_var(--card),0_0_4px_var(--card)] [&_[data-part=label][data-axis=x]]:-translate-x-1/2 [&_[data-part=label][data-axis=x]]:bottom-1.5 [&_[data-part=label][data-axis=y]]:-translate-y-1/2 [&_[data-part=label][data-axis=y]]:left-2"></audio-ui-plot-grid>
      <div class="cn-plot-graph absolute inset-0 overflow-hidden! rounded-[inherit]">
        <audio-ui-plot-curve class="cn-plot-area stroke-none" fill-to="0"></audio-ui-plot-curve>
        <audio-ui-plot-curve class="cn-plot-curve fill-none [stroke-linecap:round] [stroke-linejoin:round]"></audio-ui-plot-curve>
      </div>
      <audio-ui-plot-handle aria-label="Peak" class="cn-plot-handle size-4 cursor-grab outline-none after:absolute after:-inset-2 pointer-coarse:after:-inset-3.5 data-dragging:cursor-grabbing data-disabled:pointer-events-none" handle="peak" value='{"x":1000,"y":6}'></audio-ui-plot-handle>
    </audio-ui-plot>`;
  let peak = { x: 1000, y: 6 };
  const plot = element.querySelector("audio-ui-plot");
  const handle = element.querySelector("audio-ui-plot-handle");
  const grid = element.querySelector("audio-ui-plot-grid");
  const curves = [...element.querySelectorAll("audio-ui-plot-curve")];
  const draw = () => {
    for (const curve of curves) {
      curve.fn = (hz) => response(hz, peak);
    }
  };
  if (grid) {
    grid.x = { ticks: [100, 1000, 10_000] };
    grid.y = { ticks: [-12, 0, 12] };
  }
  draw();
  const onInput = (event) => {
    peak = event.detail.value;
    handle?.setAttribute("value", JSON.stringify(peak));
    draw();
  };
  plot?.addEventListener("input", onInput);
  return () => {
    plot?.removeEventListener("input", onInput);
    element.innerHTML = "";
  };
}
