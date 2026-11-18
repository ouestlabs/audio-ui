import "@/registry/bases/base/primitives/xypad/web";

/** Draws the pad into `element`, and returns what takes it away. */
export default function xypadWebDemo(element) {
  element.innerHTML = `
    <div class="flex flex-col items-center gap-2">
      <audio-ui-xypad class="data-disabled:cursor-not-allowed" max-x="100" max-y="100" min-x="0" min-y="0" value='{"x":50,"y":50}'>
        <audio-ui-xypad-control class="cn-xypad cn-xypad-size-default relative block aspect-square w-full cursor-crosshair touch-none select-none overflow-hidden data-disabled:pointer-events-none data-disabled:opacity-50">
          <div aria-hidden="true" class="pointer-events-none absolute inset-0">
            <div class="cn-xypad-grid-line absolute top-0 bottom-0 w-px" style="left: 20%"></div>
            <div class="cn-xypad-grid-line absolute top-0 bottom-0 w-px" style="left: 40%"></div>
            <div class="cn-xypad-grid-line absolute top-0 bottom-0 w-px" style="left: 60%"></div>
            <div class="cn-xypad-grid-line absolute top-0 bottom-0 w-px" style="left: 80%"></div>
            <div class="cn-xypad-grid-line absolute right-0 left-0 h-px" style="top: 20%"></div>
            <div class="cn-xypad-grid-line absolute right-0 left-0 h-px" style="top: 40%"></div>
            <div class="cn-xypad-grid-line absolute right-0 left-0 h-px" style="top: 60%"></div>
            <div class="cn-xypad-grid-line absolute right-0 left-0 h-px" style="top: 80%"></div>
          </div>
          <div aria-hidden="true" class="cn-xypad-crosshair pointer-events-none absolute top-0 bottom-0 left-(--xy-pad-x) w-px"></div>
          <div aria-hidden="true" class="cn-xypad-crosshair pointer-events-none absolute top-(--xy-pad-y) right-0 left-0 h-px"></div>
          <audio-ui-xypad-thumb aria-label="Position" class="pointer-events-none absolute size-5">
            <div class="cn-xypad-cursor-glow absolute inset-0 transition-opacity duration-200 motion-reduce:transition-none"></div>
            <div class="cn-xypad-cursor-dot absolute inset-1"></div>
            <div class="cn-xypad-cursor-highlight absolute inset-2"></div>
          </audio-ui-xypad-thumb>
          <audio-ui-xypad-value class="cn-xypad-value absolute top-2.5 right-2.5 z-10"></audio-ui-xypad-value>
        </audio-ui-xypad-control>
      </audio-ui-xypad>
      <output aria-live="polite" class="font-mono text-foreground text-sm tabular-nums">X: 50 - Y: 50</output>
    </div>`;
  const pad = element.querySelector("audio-ui-xypad");
  const output = element.querySelector("output");
  const update = (event) => {
    const { x, y } = event.detail.value;
    if (output) {
      output.textContent = `X: ${x} - Y: ${y}`;
    }
  };
  pad?.addEventListener("input", update);
  return () => {
    pad?.removeEventListener("input", update);
    element.innerHTML = "";
  };
}
