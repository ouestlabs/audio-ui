import "@/registry/primitives/xypad/web";

const LINES = [20, 40, 60, 80];

/** A line of the grid, across or down, at a share of the pad. */
const line = (orientation, position) =>
  `<div data-orientation="${orientation}" data-slot="xypad-grid-line" style="${orientation === "vertical" ? "left" : "top"}: ${position}%"></div>`;

/** Draws the pad into `element`, and returns what takes it away. Its look is the pad's sheet, on its parts and attributes. */
export default function xypadWebDemo(element) {
  element.innerHTML = `
    <audio-ui-xypad data-size="default" max-x="100" max-y="100" min-x="0" min-y="0" style="width: 12rem" value='{"x":50,"y":50}'>
      <audio-ui-xypad-control>
        <div aria-hidden="true" data-slot="xypad-grid">${LINES.map((position) => line("vertical", position)).join("")}${LINES.map((position) => line("horizontal", position)).join("")}</div>
        <div aria-hidden="true" data-orientation="vertical" data-slot="xypad-crosshair"></div>
        <div aria-hidden="true" data-orientation="horizontal" data-slot="xypad-crosshair"></div>
        <audio-ui-xypad-thumb aria-label="Position">
          <div data-slot="xypad-cursor-glow"></div>
          <div data-slot="xypad-cursor-dot"></div>
          <div data-slot="xypad-cursor-highlight"></div>
        </audio-ui-xypad-thumb>
        <audio-ui-xypad-value></audio-ui-xypad-value>
      </audio-ui-xypad-control>
    </audio-ui-xypad>`;
  return () => {
    element.innerHTML = "";
  };
}
