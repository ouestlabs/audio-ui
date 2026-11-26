import "@/registry/primitives/plot/web";

const response = (hz, point) =>
  point.y * Math.exp(-(Math.log2(hz / point.x) ** 2));

/** Draws the plot into `element`, and returns what takes it away. A curve is a function, so it is set as a property. */
export default function plotWebDemo(element) {
  element.innerHTML = `
    <audio-ui-plot max-x="20000" max-y="12" min-x="20" min-y="-12" scale-x="log">
      <audio-ui-plot-grid></audio-ui-plot-grid>
      <div data-slot="plot-graph">
        <audio-ui-plot-curve fill-to="0"></audio-ui-plot-curve>
        <audio-ui-plot-curve></audio-ui-plot-curve>
      </div>
      <audio-ui-plot-handle aria-label="Peak" handle="peak" value='{"x":1000,"y":6}'></audio-ui-plot-handle>
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
