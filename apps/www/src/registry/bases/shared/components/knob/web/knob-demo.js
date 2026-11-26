import "@/registry/primitives/knob/web";

const NEEDLE = `<svg aria-hidden="true" data-slot="knob-needle" viewBox="0 0 48 48"><line stroke="currentColor" stroke-linecap="round" stroke-width="2.75" x1="24" x2="24" y1="11.53" y2="18.84" /></svg>`;

/** A graduation around the dial, with its label when it has one. */
const mark = (value, label) => `
      <audio-ui-knob-mark value="${value}">
        <span data-slot="knob-mark-tick"></span>${label === undefined ? "" : `<span data-slot="knob-mark-label">${label}</span>`}
      </audio-ui-knob-mark>`;

/** Draws the knob into `element`, and returns what takes it away. Its look is the knob's sheet, on its parts and attributes. */
export default function knobWebDemo(element) {
  element.innerHTML = `
    <audio-ui-knob data-marks="labels" data-readout="auto" data-size="lg" max="100" min="0" step="1" value="50">
      <audio-ui-knob-control>
        <div data-slot="knob-body"></div>
        <audio-ui-knob-track></audio-ui-knob-track>
        <audio-ui-knob-indicator></audio-ui-knob-indicator>
        <audio-ui-knob-thumb aria-label="Level">${NEEDLE}</audio-ui-knob-thumb>
      </audio-ui-knob-control>${mark(0, "0")}${mark(25)}${mark(50)}${mark(75)}${mark(100, "100")}
      <audio-ui-knob-value></audio-ui-knob-value>
    </audio-ui-knob>`;
  return () => {
    element.innerHTML = "";
  };
}
